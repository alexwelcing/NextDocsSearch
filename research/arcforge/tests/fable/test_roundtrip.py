"""Fable packets end to end: pack, a simulated agent answers, check — accepted, retried, closed."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from arcforge.contract import schema
from arcforge.contract.ids import RUN_IDS, STRIPPED_FIELDS
from arcforge.contract.verdicts import stripped_keys_present
from arcforge.fable import blind, ledger, packer

FABLE = 'claude-fable-5-1'


def files_in(directory: Path) -> set[str]:
    return {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}


def assert_fable_call(record: dict) -> None:
    assert schema.errors(record, definition='FableCall') == []


# ---- the packet -------------------------------------------------------------------------------


def test_a_packet_holds_exactly_its_files(pairs, rubric, root):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    workdir = packet.workdir(1)
    assert files_in(workdir) == {
        'packet.json',
        'INSTRUCTIONS.md',
        'output.schema.json',
        'inputs/pairs.json',
        'inputs/rubric.md',
    }
    manifest = json.loads((workdir / 'packet.json').read_text())
    assert (
        manifest == packet.manifest
        and schema.errors(
            manifest,
            json.loads(
                (packer.Path(packer.__file__).with_name('schemas') / 'packet-1.json').read_text()
            ),
        )
        == []
    )
    assert (manifest['kind'], manifest['role'], manifest['run_id']) == (
        'gold_audit',
        'gold_audit_1',
        'r00',
    )
    assert packet.sha256 == packer.sha256_bytes(packer.canonical_bytes(manifest))
    assert packet.root.name == f'gold_audit-r00-{packet.sha256[:12]}'
    instructions = (workdir / 'INSTRUCTIONS.md').read_text()
    assert (
        '3 queries, 6 pairs' in instructions
        and 'output.json' in instructions
        and '{{' not in instructions
    )


def test_packets_are_content_addressed(pairs, rubric, root, tmp_path):
    first = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    again = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    assert (again.sha256, again.root) == (first.sha256, first.root)
    assert len(json.loads(first.ledger_path.read_text())['attempts']) == 1  # reuse opens nothing
    other_rubric = tmp_path / 'other.md'
    other_rubric.write_text('# another rubric\n')
    assert (
        packer.pack_gold_audit(pairs, other_rubric, shape=(3, 2), root=root).sha256 != first.sha256
    )


def test_a_tampered_canonical_packet_is_not_reused(pairs, rubric, root):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    (packet.canonical / 'inputs' / 'rubric.md').write_text('# edited after packing\n')
    with pytest.raises(packer.PacketError, match='no longer matches its manifest'):
        packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    with pytest.raises(packer.PacketError, match='no longer matches its manifest'):
        ledger.check(packet.root, session='s1', model=FABLE)


def test_packets_refuse_a_git_work_tree(pairs, rubric, tmp_path):
    (tmp_path / 'repo' / '.git').mkdir(parents=True)
    with pytest.raises(packer.PacketError, match='inside the git work tree'):
        packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=tmp_path / 'repo' / 'fable')


def test_the_gold_audit_shape_is_enforced(pairs, rubric, root):
    with pytest.raises(packer.PacketError, match='60 queries x 12 candidates'):
        packer.pack_gold_audit(pairs, rubric, root=root)


def test_a_role_runs_only_at_its_runs(pairs, rubric, root):
    doc = json.loads(pairs.read_text())
    doc['audit_index'] = 2  # gold audit #2 belongs to R10/R10K, not R00
    pairs.write_text(json.dumps(doc))
    with pytest.raises(packer.PacketError, match="role 'gold_audit_2' does not run at 'r00'"):
        packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)


def test_malformed_pairs_are_refused(pairs, rubric, root):
    doc = json.loads(pairs.read_text())
    doc['queries'][0]['candidates'][0]['grade'] = 3  # no such field: the agent must not see labels
    pairs.write_text(json.dumps(doc))
    with pytest.raises(packer.PacketError, match='pairs'):
        packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)


# ---- accepted, retried, failed closed ---------------------------------------------------------


def test_a_valid_output_is_accepted(pairs, rubric, root, agent):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    agent.write(packet.workdir(1), 'gold_audit', agent.grades(packet.workdir(1)))
    result = ledger.check(packet.root, session='sess-1', model=FABLE)
    assert (result.decision, result.attempt, result.status) == ('accepted', 1, 'ok')
    accepted = packet.root / 'output.json'
    assert accepted.read_bytes() == (packet.workdir(1) / 'output.json').read_bytes()
    record = ledger.record(packet.root)
    assert_fable_call(record)
    assert record == {
        'role': 'gold_audit_1', 'kind': 'gold_audit', 'via': 'orchestrator', 'packet_sha256': packet.sha256,
        'output_sha256': packer.sha256_bytes(accepted.read_bytes()), 'agent_session': 'sess-1',
        'model_reported': FABLE, 'attempts': 1, 'repair_cycle': 0, 'refusals': [], 'status': 'ok',
        'lint_ok': None,
    }  # fmt: skip
    assert ledger.accepted_output(packet.root)['result']['grades'][0]['grade'] == 2
    with pytest.raises(packer.PacketError, match='already final'):
        ledger.check(packet.root, session='sess-2', model=FABLE)


def test_an_invalid_output_is_retried_once_in_a_fresh_directory(pairs, rubric, root, agent):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    agent.write(packet.workdir(1), 'gold_audit', agent.grades(packet.workdir(1), skip=1))
    first = ledger.check(packet.root, session='sess-1', model=FABLE)
    assert (first.decision, first.outcome, first.status) == ('retry', 'invalid', None)
    assert any('missing graded pair: 1' in e for e in first.errors)
    assert not packet.workdir(1).exists()
    assert (packet.root / 'rejected' / 'attempt-1.output.json').exists()
    assert first.workdir == packet.workdir(2) and 'output.json' not in files_in(packet.workdir(2))
    assert packer.verify_dir(packet.workdir(2), packet.manifest, allow=('packet.json',)) == []
    agent.write(packet.workdir(2), 'gold_audit', agent.grades(packet.workdir(2)))
    second = ledger.check(packet.root, session='sess-2', model=FABLE)
    assert (second.decision, second.attempt, second.status) == ('accepted', 2, 'ok')
    record = ledger.record(packet.root)
    assert (record['attempts'], record['agent_session'], record['status']) == (2, 'sess-2', 'ok')


def test_two_invalid_outputs_fail_closed(pairs, rubric, root, agent):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    (packet.workdir(1) / 'output.json').write_text('{not json')
    assert ledger.check(packet.root, session='s1', model=FABLE).decision == 'retry'
    agent.write(
        packet.workdir(2),
        'gold_audit',
        {'grades': [{'query_id': 'q0', 'candidate_id': 'q0:c0', 'grade': 4, 'note': None}]},
    )
    closed = ledger.check(packet.root, session='s2', model=FABLE)
    assert (closed.decision, closed.status) == ('failed_closed', 'failed')
    assert not (packet.root / 'output.json').exists()
    record = ledger.record(packet.root)
    assert_fable_call(record)
    assert (record['status'], record['output_sha256'], record['attempts']) == ('failed', None, 2)
    assert ledger.accepted_output(packet.root) is None
    diff = packet.root.parent / 'fix.diff'
    diff.write_text('--- a\n+++ b\n')
    with pytest.raises(packer.PacketError, match='only a refused PREREG sign-off'):
        ledger.repair(packet.root, diff, {'rules': diff})


def test_a_missing_output_is_invalid(pairs, rubric, root):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    result = ledger.check(packet.root, session='s1', model=FABLE)
    assert result.decision == 'retry' and result.errors == ['no output.json was written']


def test_only_fable_may_answer(pairs, rubric, root, agent):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    agent.write(packet.workdir(1), 'gold_audit', agent.grades(packet.workdir(1)))
    result = ledger.check(packet.root, session='s1', model='claude-opus-5-5')
    assert result.decision == 'retry' and any(
        'no other model may stand in for Fable' in e for e in result.errors
    )


@pytest.mark.parametrize('tamper', ['change', 'extra'])
def test_a_tampered_working_directory_is_invalid(pairs, rubric, root, agent, tamper):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    workdir = packet.workdir(1)
    agent.write(workdir, 'gold_audit', agent.grades(workdir))
    if tamper == 'change':
        (workdir / 'inputs' / 'rubric.md').write_text('# anything goes\n')
    else:
        (workdir / 'notes.txt').write_text('scratch')
    result = ledger.check(packet.root, session='s1', model=FABLE)
    assert result.outcome == 'invalid'
    assert any(
        ('was changed' if tamper == 'change' else 'unexpected files') in e for e in result.errors
    )


# ---- the PREREG sign-off ----------------------------------------------------------------------


def test_the_sign_off_round_trip(signoff_files, root, agent):
    packet = packer.pack_signoff(**signoff_files, root=root)
    assert files_in(packet.workdir(1)) >= {
        'inputs/lint.json',
        'inputs/r00/verdicts.json',
        'inputs/bench-card.md',
        'inputs/rules.yaml',
        # the A0 records
        'inputs/PREREG-A0.json',
        'inputs/witness-index.json',
        'inputs/model-choice-a0.json',
        'inputs/contamination.json',
        'inputs/provenance.json',
        'inputs/panel-summary.json',
        'inputs/quarantine.json',
    }
    instructions = (packet.workdir(1) / 'INSTRUCTIONS.md').read_text()
    assert 'This is the first submission.' in instructions and 'owner may sign' not in instructions
    assert packet.manifest['repair_cycle'] == 0
    # An invalid output is still retried once in a fresh agent.
    (packet.workdir(1) / 'output.json').write_text('{}')
    assert ledger.check(packet.root, session='s1', model=FABLE).decision == 'retry'
    agent.write(packet.workdir(2), 'prereg_signoff', agent.signature())
    accepted = ledger.check(packet.root, session='s2', model=FABLE)
    assert accepted.decision == 'accepted'
    record = ledger.record(packet.root)
    assert_fable_call(record)
    assert (record['role'], record['attempts'], record['status'], record['lint_ok']) == (
        'signoff',
        2,
        'ok',
        True,
    )
    assert (record['repair_cycle'], record['refusals']) == (0, [])


def test_a_signature_must_pass_every_check(signoff_files, root, agent):
    packet = packer.pack_signoff(**signoff_files, root=root)
    result = agent.signature()
    result['checks'][3]['ok'] = False  # 'sign' with a failing check is not a signature
    agent.write(packet.workdir(1), 'prereg_signoff', result)
    assert ledger.check(packet.root, session='s1', model=FABLE).outcome == 'invalid'
    duplicated = agent.signature()
    duplicated['checks'][1] = dict(duplicated['checks'][0])
    agent.write(packet.workdir(2), 'prereg_signoff', duplicated)
    closed = ledger.check(packet.root, session='s2', model=FABLE)
    assert closed.status == 'failed' and any('appears twice' in e for e in closed.errors)


def test_the_a0_signoff_checks_match_the_schema():
    from arcforge.fable.kinds import KINDS, SIGNOFF_CHECKS

    schema_doc = KINDS['prereg_signoff'].schema()
    checks = schema_doc['$defs']['Result']['properties']['checks']
    assert tuple(checks['items']['properties']['id']['enum']) == SIGNOFF_CHECKS
    assert checks['minItems'] == checks['maxItems'] == len(SIGNOFF_CHECKS) == 19
    assert 'vault_seal_published_no_key_material' not in SIGNOFF_CHECKS
    assert not hasattr(ledger, 'owner_sign')


def refuse(packet, agent, attempt=1, why='lint failed'):
    agent.write(
        packet.workdir(attempt),
        'prereg_signoff',
        status='refused',
        reason=why,
        result=agent.signature(ok=False),
    )
    return ledger.check(packet.root, session=f'refuse-{packet.sha256[:6]}', model=FABLE)


def test_repair_or_halt(signoff_files, root, agent, tmp_path):
    """A0: a refusal is final for its packet; repair at most twice; the third refusal halts."""
    first = packer.pack_signoff(**signoff_files, root=root)
    result = refuse(first, agent)
    assert (result.decision, result.status) == ('failed_closed', 'refused')  # no fresh-agent retry
    assert not first.workdir(2).exists()
    refusal_1 = ledger.refusal_bytes(first.root)
    assert json.loads(refusal_1)['reason'] == 'lint failed'

    diff = tmp_path / 'fix-1.diff'
    diff.write_text('--- a/rules.yaml\n+++ b/rules.yaml\n@@ fixed the lint @@\n')
    fixed_rules = tmp_path / 'rules-fixed.yaml'
    fixed_rules.write_text(signoff_files['rules'].read_text() + '# repaired\n')
    empty = tmp_path / 'empty.diff'
    empty.write_text('')
    with pytest.raises(packer.PacketError, match='the diff is empty'):
        ledger.repair(first.root, empty, {'rules': fixed_rules}, root=root)
    with pytest.raises(packer.PacketError, match='nothing was repaired'):
        ledger.repair(first.root, diff, {'rules': signoff_files['rules']}, root=root)

    second = ledger.repair(first.root, diff, {'rules': fixed_rules}, root=root)
    assert second.manifest['repair_cycle'] == 1
    work = second.workdir(1)
    assert (work / 'inputs' / 'repair' / 'cycle-0.refusal.json').read_bytes() == refusal_1
    assert (work / 'inputs' / 'repair' / 'cycle-1.diff').read_text() == diff.read_text()
    assert (work / 'inputs' / 'rules.yaml').read_text().endswith('# repaired\n')
    assert 'repaired resubmission 1 of 2' in (work / 'INSTRUCTIONS.md').read_text()
    assert refuse(second, agent, why='still wrong').status == 'refused'

    diff_2 = tmp_path / 'fix-2.diff'
    diff_2.write_text('--- a/PREREG.md\n+++ b/PREREG.md\n')
    fixed_prereg = tmp_path / 'PREREG-fixed.md'
    fixed_prereg.write_text('# PREREG\n\nrepaired twice\n')
    third = ledger.repair(second.root, diff_2, {'prereg': fixed_prereg}, root=root)
    assert third.manifest['repair_cycle'] == 2
    names = files_in(third.workdir(1))
    assert {'inputs/repair/cycle-0.refusal.json', 'inputs/repair/cycle-1.refusal.json',
            'inputs/repair/cycle-1.diff', 'inputs/repair/cycle-2.diff'} <= names  # fmt: skip
    assert 'halts the arc at R00' in (third.workdir(1) / 'INSTRUCTIONS.md').read_text()

    halted = refuse(third, agent, why='third time')
    assert (halted.decision, halted.status) == ('failed_closed', 'halted')
    record = ledger.record(third.root)
    assert_fable_call(record)
    assert record['status'] == 'halted' and record['repair_cycle'] == 2
    assert len(record['refusals']) == 3  # every refusal, published verbatim
    with pytest.raises(packer.PacketError, match='refused three times'):
        ledger.repair(third.root, diff_2, {'prereg': signoff_files['prereg']}, root=root)


def test_a_repair_can_still_be_signed(signoff_files, root, agent, tmp_path):
    first = packer.pack_signoff(**signoff_files, root=root)
    refuse(first, agent)
    diff = tmp_path / 'fix.diff'
    diff.write_text('fix\n')
    lint_fixed = tmp_path / 'lint-fixed.json'
    lint_fixed.write_text(signoff_files['lint'].read_text().replace('"frozen": true', '"frozen":true'))
    second = ledger.repair(first.root, diff, {'lint': lint_fixed}, root=root)
    agent.write(second.workdir(1), 'prereg_signoff', agent.signature())
    assert ledger.check(second.root, session='s', model=FABLE).decision == 'accepted'
    record = ledger.record(second.root)
    assert (record['status'], record['repair_cycle'], len(record['refusals'])) == ('ok', 1, 1)


def test_only_the_signoff_is_repaired(pairs, rubric, root, agent, tmp_path):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    for attempt in (1, 2):
        agent.write(packet.workdir(attempt), 'gold_audit', status='refused', reason='no')
        ledger.check(packet.root, session=f's{attempt}', model=FABLE)
    diff = tmp_path / 'd.diff'
    diff.write_text('x\n')
    with pytest.raises(packer.PacketError, match='only a refused PREREG sign-off'):
        ledger.repair(packet.root, diff, {})


def test_the_sign_off_reads_r00(signoff_files, root, arc):
    r06 = next(r for r in arc[2] if r.run_id == 'r06')
    with pytest.raises(packer.PacketError, match='r00 verdicts.json'):
        packer.pack_signoff(
            **{**signoff_files, 'verdicts': r06.run_dir / 'verdicts.json'}, root=root
        )


# ---- the end review: blind pass, comparison, mismatch pass ------------------------------------


def blind_packet(arc, root):
    rules_path, _, runs = arc
    prereg = root.parent / 'PREREG.md'
    prereg.write_text('# PREREG\n')
    return packer.pack_blind(
        prereg=prereg,
        rules=rules_path,
        verdicts=[r.run_dir / 'verdicts.json' for r in runs],
        root=root,
    )


def stripped_docs(workdir: Path) -> list[dict]:
    docs = [json.loads(p.read_text()) for p in (workdir / 'inputs' / 'verdicts').glob('*.json')]
    return sorted(docs, key=lambda d: RUN_IDS.index(d['run']['id']))


def test_the_blind_packet_is_stripped_and_isolated(arc, root):
    packet = blind_packet(arc, root)
    workdir = packet.workdir(1)
    names = files_in(workdir)
    assert {n for n in names if n.startswith('inputs/verdicts/')} == {
        f'inputs/verdicts/{r.run_id}.json' for r in arc[2]
    }
    assert not any('report' in n for n in names)
    assert packet.manifest['stripped'] == list(STRIPPED_FIELDS)
    for doc in stripped_docs(workdir):
        assert stripped_keys_present(doc) == []
        assert schema.errors(doc, definition='VerdictsDocBlind') == []
        assert all('point' in r and 'ci_lo_adj' in r for r in doc['rows'])
    assert '`gates_summary`' in (workdir / 'INSTRUCTIONS.md').read_text()


def test_the_blind_packet_needs_the_whole_path(arc, root):
    rules_path, _, runs = arc
    prereg = root.parent / 'PREREG.md'
    prereg.write_text('# PREREG\n')
    partial = [r.run_dir / 'verdicts.json' for r in runs if r.run_id != 'r05']
    with pytest.raises(packer.PacketError, match='verdicts'):
        packer.pack_blind(prereg=prereg, rules=rules_path, verdicts=partial, root=root)
    with pytest.raises(packer.PacketError, match='every run of the realized path'):
        packer.pack_blind(
            prereg=prereg,
            rules=rules_path,
            verdicts=[r.run_dir / 'verdicts.json' for r in runs[:6]],
            root=root,
        )


def test_a_correct_blind_pass_matches_every_verdict(arc, root, agent):
    _, rules, runs = arc
    packet = blind_packet(arc, root)
    result = blind.reference_result(rules, stripped_docs(packet.workdir(1)))  # the simulated Fable
    agent.write(packet.workdir(1), 'blind_recompute', result)
    assert ledger.check(packet.root, session='s1', model=FABLE).decision == 'accepted'
    table = blind.compare(
        ledger.accepted_output(packet.root)['result'], [r.outcome.doc for r in runs]
    )
    assert table['mismatches'] == [] and table['checked'] > 300


def test_a_wrong_blind_verdict_becomes_a_mismatch_and_the_mismatch_pass_answers_it(
    arc, root, agent, tmp_path
):
    rules_path, rules, runs = arc
    packet = blind_packet(arc, root)
    result = blind.reference_result(rules, stripped_docs(packet.workdir(1)))
    r06 = next(r for r in result['runs'] if r['run_id'] == 'r06')
    next(h for h in r06['hypotheses'] if h['id'] == 'H1')['status'] = 'FUSION_ONLY'
    result['arc_summary'][0]['final_status'] = 'FIRED'
    agent.write(packet.workdir(1), 'blind_recompute', result)
    assert ledger.check(packet.root, session='s1', model=FABLE).decision == 'accepted'
    table = blind.compare(
        ledger.accepted_output(packet.root)['result'], [r.outcome.doc for r in runs]
    )
    found = {
        (m['mismatch_id'], m['run_id'], m['item'], m['field'], m['reported'], m['recomputed'])
        for m in table['mismatches']
    }
    assert found == {
        ('m001', 'r06', 'hypotheses.H1', 'status', 'SUPPORTED', 'FUSION_ONLY'),
        ('m002', 'r10', 'arc_summary.FUT', 'final_status', 'NOT_FIRED', 'FIRED'),
    }
    comparison = tmp_path / 'comparison.json'
    comparison.write_text(json.dumps(table))
    writeup = tmp_path / 'writeup.md'
    writeup.write_text('# The calibration runs\n')
    review = packer.pack_mismatch(
        prereg=root.parent / 'PREREG.md', rules=rules_path, writeup=writeup,
        reports=[r.run_dir / 'report.json' for r in runs], comparison=comparison, root=root,
    )  # fmt: skip
    assert '2 mismatches' in (review.workdir(1) / 'INSTRUCTIONS.md').read_text()
    answer = {
        'mismatches': [
            {'mismatch_id': 'm001', 'assessment': 'reported_correct', 'resolution': 'c3 passes.'}
        ],
        'writeup_findings': [],
        'statement': 'One mismatch is mine.',
    }
    agent.write(review.workdir(1), 'mismatch_review', answer)
    first = ledger.check(review.root, session='s1', model=FABLE)
    assert first.decision == 'retry' and any('missing mismatch: 1' in e for e in first.errors)
    answer['mismatches'].append(
        {'mismatch_id': 'm002', 'assessment': 'reported_correct', 'resolution': 'FUT never fired.'}
    )
    agent.write(review.workdir(2), 'mismatch_review', answer)
    assert ledger.check(review.root, session='s2', model=FABLE).decision == 'accepted'


def test_the_blind_pass_must_cover_every_run_rule_and_row(arc, root, agent):
    _, rules, _ = arc
    packet = blind_packet(arc, root)
    result = blind.reference_result(rules, stripped_docs(packet.workdir(1)))
    result['runs'].pop(3)
    result['runs'][0]['hypotheses'].pop()
    agent.write(packet.workdir(1), 'blind_recompute', result)
    checked = ledger.check(packet.root, session='s1', model=FABLE)
    assert checked.outcome == 'invalid'
    assert any('missing run: 1' in e for e in checked.errors) and any(
        'r00: missing rule: 1' in e for e in checked.errors
    )


def test_a_missing_end_review_is_marked_missing(arc, root):
    packet = blind_packet(arc, root)
    record = ledger.mark_missing(packet.root, 'the orchestrator was unavailable')
    assert_fable_call(record)
    assert record['status'] == 'missing' and record['attempts'] == 0


def test_only_the_end_review_can_be_missing(pairs, rubric, root):
    packet = packer.pack_gold_audit(pairs, rubric, shape=(3, 2), root=root)
    with pytest.raises(packer.PacketError, match='only the end review'):
        ledger.mark_missing(packet.root, 'no')

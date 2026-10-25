"""Temporary smoke: toy inputs through S13 and the tail."""

import json

from arcforge.contract import prereg_doc
from arcforge.contract.lint import PRODUCES_PATH
from arcforge.contract.rules import TEMPLATE_PATH, load_rules
from arcforge.eval import io, report, tail, toy


def test_smoke():
    inputs = toy.toy_inputs()
    config = {'run': {'id': 'r00', 'branch': 'N', 'h1_provisional': None, 'one_change': 'x', 'prediction': 'y'}}
    out = report.evaluate_run(inputs, config, load_rules(), resamples=100, power_resamples=200)
    pre = json.loads(out['report.pre.json'])
    print(json.dumps(pre['gates'], indent=1)[:3000])
    print(pre['problems'])
    res = tail.run_tail(
        pre=pre, scores_tar=out['scores.tar'], qrels_rows=io.read_jsonl(out['qrels.final.jsonl.gz']),
        template_text=TEMPLATE_PATH.read_text(), pre_text=prereg_doc.PRE_PATH.read_text(),
        produces_text=PRODUCES_PATH.read_text(), a0_bytes=b'{"a0": true}',
        model_choice={'variant': '13b'},
        witness_index=[{'kind': 'a0', 'digest': report.sha256(b'{"a0": true}'), 'log_index': 1},
                       {'kind': 's0', 'digest': '0' * 64, 'log_index': 2},
                       {'kind': 'r00-sets', 'digest': '1' * 64, 'log_index': 3}],
        power_resamples=200,
    )
    checks = json.loads(res['tail_checks.json'])
    print(json.dumps(checks, indent=1))
    assert False

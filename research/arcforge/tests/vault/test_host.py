from arcforge.vault.host import runner_reason


def _reason(tmp_path, env=None, dmi=None, container=False, hostname='alex-mbp'):
    tmp_path = tmp_path / str(len(list(tmp_path.iterdir())))  # a fresh folder per call
    tmp_path.mkdir()
    dmi_file = tmp_path / 'product_name'
    if dmi is not None:
        dmi_file.write_text(dmi + '\n')
    marker = tmp_path / '.dockerenv'
    if container:
        marker.write_text('')
    return runner_reason(env or {}, (dmi_file,), (marker,), hostname)


def test_a_laptop_passes(tmp_path):
    assert _reason(tmp_path, dmi='MacBookPro18,3') is None


def test_runner_vm_and_ci_and_containers_are_refused(tmp_path):
    assert 'runner' in _reason(tmp_path, env={'ARCFORGE_RUNNER': '1'})
    assert 'CI' in _reason(tmp_path, env={'GITHUB_ACTIONS': 'true'})
    assert 'CI' in _reason(tmp_path, env={'CI': '1'})
    assert 'Kubernetes' in _reason(tmp_path, env={'KUBERNETES_SERVICE_HOST': '10.0.0.1'})
    assert 'container' in _reason(tmp_path, container=True)
    assert 'Google Compute Engine' in _reason(tmp_path, dmi='Google Compute Engine')
    assert 'runner VM' in _reason(tmp_path, hostname='arc-run-r04-3a74fb4')

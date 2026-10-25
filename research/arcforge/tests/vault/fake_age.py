"""A stand-in for `age` and `age-keygen` with the same command lines, for machines without age.

TEST DOUBLE ONLY: the 'encryption' is a keyed XOR anyone holding the recipient can undo. It
exists so the vault's plumbing (pipes, armor, recipient checks, error paths) is tested in CI;
tests/vault/test_age_real.py runs the same flows against the real age wherever it is installed.

Usage: fake_age.py age [age args...] | fake_age.py age-keygen [-y]
"""

import base64
import hashlib
import json
import secrets
import sys

BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
HEADER = '-----BEGIN AGE ENCRYPTED FILE-----'
FOOTER = '-----END AGE ENCRYPTED FILE-----'


def chars(seed: bytes, n: int = 58) -> str:
    out, counter = '', 0
    while len(out) < n:
        block = hashlib.sha256(seed + counter.to_bytes(4, 'big')).digest()
        out += ''.join(BECH32[b % 32] for b in block)
        counter += 1
    return out[:n]


def recipient_of(identity: str) -> str:
    return 'age1' + chars(b'recipient' + identity.encode())


def stream(recipient: str, n: int) -> bytes:
    out, counter = b'', 0
    while len(out) < n:
        out += hashlib.sha256(recipient.encode() + counter.to_bytes(4, 'big')).digest()
        counter += 1
    return out[:n]


def fail(message: str) -> int:
    sys.stderr.write(f'age: error: {message}\n')
    return 1


def keygen(args: list[str]) -> int:
    if args == ['-y']:
        identity = sys.stdin.read().strip()
        if not identity.startswith('AGE-SECRET-KEY-1') or len(identity) != 74:
            return fail('malformed secret key')
        print(recipient_of(identity))
        return 0
    identity = 'AGE-SECRET-KEY-1' + chars(secrets.token_bytes(32)).upper()
    print('# created: 2026-10-24T00:00:00Z')
    print(f'# public key: {recipient_of(identity)}')
    print(identity)
    sys.stderr.write(f'Public key: {recipient_of(identity)}\n')
    return 0


def age(args: list[str]) -> int:
    if args == ['--version']:
        print('v0.0.0-fake')
        return 0
    if args[:3] == ['--encrypt', '--armor', '-r'] and len(args) == 4:
        recipient = args[3]
        data = sys.stdin.buffer.read()
        body = bytes(a ^ b for a, b in zip(data, stream(recipient, len(data)), strict=True))
        blob = json.dumps({'r': recipient, 'd': base64.b64encode(body).decode()}).encode()
        sys.stdout.write(f'{HEADER}\n{base64.b64encode(blob).decode()}\n{FOOTER}\n')
        return 0
    if args[:3] == ['--decrypt', '-i', '-'] and len(args) == 4:
        identity = sys.stdin.read().strip()
        if not identity.startswith('AGE-SECRET-KEY-1'):
            return fail('malformed secret key')
        with open(args[3], encoding='ascii') as handle:
            text = handle.read().split('\n')
        if text[0] != HEADER:
            return fail('not an age file')
        blob = json.loads(base64.b64decode(text[1]))
        if blob['r'] != recipient_of(identity):
            return fail('no identity matched any of the recipients')
        body = base64.b64decode(blob['d'])
        sys.stdout.buffer.write(
            bytes(a ^ b for a, b in zip(body, stream(blob['r'], len(body)), strict=True))
        )
        return 0
    return fail(f'unsupported arguments {args}')


if __name__ == '__main__':
    tool, rest = sys.argv[1], sys.argv[2:]
    sys.exit(keygen(rest) if tool == 'age-keygen' else age(rest))

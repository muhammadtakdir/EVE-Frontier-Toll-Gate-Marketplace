#[test_only]
module toll_gate::toll_gate_tests;

#[error(code = 0)]
const ENotImplemented: vector<u8> = b"Not Implemented";

#[test]
fun test_toll_gate() {
    // pass
}

#[test, expected_failure(abort_code = ::toll_gate::toll_gate_tests::ENotImplemented)]
fun test_toll_gate_fail() {
    abort ENotImplemented
}

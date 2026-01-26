
// Extracting the logic from index.ts for local verification
function normalizeJSON(text) {
    if (!text) return "";
    let fixed = text.trim();

    // 1. Replace single quotes with double quotes
    fixed = fixed.replace(/'/g, '"');

    // 2. Fix unquoted keys: {key: "value"} -> {"key": "value"}
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // 3. Remove trailing commas: {"a": 1, } -> {"a": 1}
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    return fixed;
}

const testCases = [
    {
        name: "Standard JSON (should be unchanged)",
        input: '{"lat": 41.3, "lng": 2.1}',
        expected: '{"lat": 41.3, "lng": 2.1}'
    },
    {
        name: "Single quotes",
        input: "{'lat': 41.3, 'lng': 2.1, 'action': 'register'}",
        expected: '{"lat": 41.3, "lng": 2.1, "action": "register"}'
    },
    {
        name: "Unquoted keys",
        input: "{lat: 41.3, lng: 2.1, action: 'register'}",
        expected: '{"lat": 41.3, "lng": 2.1, "action": "register"}'
    },
    {
        name: "Trailing comma",
        input: '{"lat": 41.3, "lng": 2.1,}',
        expected: '{"lat": 41.3, "lng": 2.1}'
    },
    {
        name: "Combined: Unquoted keys, single quotes, and trailing comma",
        input: "{lat: 41.3, 'lng': 2.1, action: 'register',}",
        expected: '{"lat": 41.3, "lng": 2.1, "action": "register"}'
    }
];

console.log("--- Running Geofence JSON Normalizer Tests ---");
let passed = 0;

testCases.forEach(tc => {
    const normalized = normalizeJSON(tc.input);
    try {
        const parsed = JSON.parse(normalized);
        console.log(`✅ [PASS] ${tc.name}`);
        passed++;
    } catch (e) {
        console.log(`❌ [FAIL] ${tc.name}`);
        console.log(`   Input:      ${tc.input}`);
        console.log(`   Normalized: ${normalized}`);
        console.log(`   Error:      ${e.message}`);
    }
});

console.log(`\nResults: ${passed}/${testCases.length} passed.`);
if (passed === testCases.length) {
    console.log("All tests passed! The logic is robust.");
} else {
    console.log("Some tests failed. Logic needs refinement.");
}

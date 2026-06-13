<?php
// stats.php - Receives anonymous game statistics from Diggy Diggy clients.
// Expects POST with JSON body: { "uuid": "...", "savedata": { "gold": ..., "startX": ..., ... } }

require_once __DIR__ . '/db_config.php';

// Sanity limits
const MAX_BODY_BYTES  = 524288;      // 512 KB — saves shouldn't be larger
const MAX_GOLD        = 1.0e13;      // 10 trillion gold; anything above is bogus
const MAX_DEPTH       = 10000000;    // 10 million rows; physically unreachable
const MAX_FUTURE_MS   = 300000;      // 5 minutes clock skew tolerance
const MAX_AGE_MS      = 31536000000; // 1 year old timestamps are stale but acceptable

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

function fail(int $code, string $reason): never {
    http_response_code($code);
    echo json_encode(['error' => $reason]);
    exit;
}

// Browsers send a preflight OPTIONS request before cross-origin POSTs
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed');
}

// Reject oversized bodies before reading
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_BODY_BYTES) {
    fail(413, 'Payload too large');
}

$body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if (strlen($body) > MAX_BODY_BYTES) {
    fail(413, 'Payload too large');
}

$payload = json_decode($body, true);
if (!is_array($payload) || empty($payload['uuid']) || !is_array($payload['savedata'])) {
    fail(400, 'Missing or invalid uuid / savedata fields');
}

// Validate UUID v4 format
$uuid = $payload['uuid'];
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid)) {
    fail(400, 'Invalid UUID format');
}

$save = $payload['savedata'];

// gold: must be a finite non-negative number within plausible range
$gold = $save['gold'] ?? null;
if (!is_numeric($gold) || !is_finite((float) $gold) || (float) $gold < 0 || (float) $gold > MAX_GOLD) {
    fail(422, 'gold out of valid range');
}
$gold = (float) $gold;

// depth (startX): non-negative integer within plausible range
$depth = $save['startX'] ?? null;
if (!is_numeric($depth) || (int) $depth < 0 || (int) $depth > MAX_DEPTH) {
    fail(422, 'startX (depth) out of valid range');
}
$depth = (int) $depth;

// timestamp: must be a plausible Unix millisecond value
$nowMs     = (int) (microtime(true) * 1000);
$timestamp = $save['timestamp'] ?? null;
if (!is_numeric($timestamp)
    || (int) $timestamp > $nowMs + MAX_FUTURE_MS
    || (int) $timestamp < $nowMs - MAX_AGE_MS) {
    // Fall back to server time rather than rejecting — clock drift is common
    $timestamp = $nowMs;
} else {
    $timestamp = (int) $timestamp;
}

// Re-encode only the savedata we received (already stripped of history by client)
$saveJson = json_encode($save, JSON_UNESCAPED_UNICODE);
if ($saveJson === false) {
    fail(422, 'savedata could not be re-encoded');
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Upsert game record: preserve first_seen on conflict
    $pdo->prepare('
        INSERT INTO games (uuid, first_seen, last_seen, savedata)
        VALUES (:uuid, :ts, :ts, :savedata)
        ON DUPLICATE KEY UPDATE
            last_seen = VALUES(last_seen),
            savedata  = VALUES(savedata)
    ')->execute([
        ':uuid'     => $uuid,
        ':ts'       => $timestamp,
        ':savedata' => $saveJson,
    ]);

    // Append depth snapshot
    $pdo->prepare('
        INSERT INTO depth_stats (uuid, recorded_at, depth, gold)
        VALUES (:uuid, :recorded_at, :depth, :gold)
    ')->execute([
        ':uuid'        => $uuid,
        ':recorded_at' => $timestamp,
        ':depth'       => $depth,
        ':gold'        => $gold,
    ]);

    http_response_code(204);

} catch (PDOException $e) {
    error_log('stats.php DB error: ' . $e->getMessage());
    // Return a generic message — never expose DB internals to the client
    fail(500, 'Database error — check server error log');
}

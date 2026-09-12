/**
 * Hand-bumped semver constants (research.md §5). Engine version and schema
 * version move independently, per the constitution's Governance section:
 * "Protocol version, engine version, registry version, and schema version are
 * versioned separately." Bump the relevant constant as part of any PR that
 * changes that surface — do not derive these from package.json or git tags.
 */
export const ENGINE_VERSION = '0.1.0';
export const SCHEMA_VERSION = '0.1.0';

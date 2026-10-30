// Limits and small shared helpers.


export const HARD_MAX_INPUTS = 32;

export const HARD_MAX_GATES = 256;

export const ANALYSIS_MAX_INPUTS = 12;   // truth table / K-map / simplification need 2^n rows

export const MAX_GATE_FANIN = 6;

export const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// What the parser allows when the caller gives no limits (the settings page can raise them up to HARD_MAX_*).
export const DEFAULT_MAX_INPUTS = 12;
export const DEFAULT_MAX_GATES = 64;

export const REDUCE_METHODS = ['structural', 'best', 'sop', 'pos', 'nand', 'nor'];

export const TIMING_VIEWS = ['graph', 'animation', 'both'];

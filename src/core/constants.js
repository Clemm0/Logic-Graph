// packages/logic-graph/src/core/constants.js
export const HARD_MAX_INPUTS = 32;
export const HARD_MAX_GATES = 256;
export const ANALYSIS_MAX_INPUTS = 12;
export const MAX_GATE_FANIN = 6;
export const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const DEFAULT_MAX_INPUTS = 12;
export const DEFAULT_MAX_GATES = 64;
export const REDUCE_METHODS = ["structural", "best", "sop", "pos", "nand", "nor"];
export const TIMING_VIEWS = ["graph", "animation", "both"];


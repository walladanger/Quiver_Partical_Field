export type FieldFn = (x: number, y: number, t: number) => number;

export type CompileResult =
  | { ok: true; fn: FieldFn; js: string }
  | { ok: false; error: string };

type Tok =
  | { k: "num"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "lp" }
  | { k: "rp" }
  | { k: "comma" };

const FN_JS: Record<string, string> = {
  sin: "Math.sin",
  cos: "Math.cos",
  tan: "Math.tan",
  asin: "Math.asin",
  acos: "Math.acos",
  atan: "Math.atan",
  atan2: "Math.atan2",
  sinh: "Math.sinh",
  cosh: "Math.cosh",
  tanh: "Math.tanh",
  exp: "Math.exp",
  log: "Math.log",
  ln: "Math.log",
  log10: "Math.log10",
  log2: "Math.log2",
  sqrt: "Math.sqrt",
  abs: "Math.abs",
  sign: "Math.sign",
  floor: "Math.floor",
  ceil: "Math.ceil",
  round: "Math.round",
  min: "Math.min",
  max: "Math.max",
  pow: "Math.pow",
  hypot: "Math.hypot",
};

const SPECIAL_FN = new Set(["sec", "csc", "cot"]);

const VARS = new Set(["x", "y", "t", "r", "theta"]);

const CONST_JS: Record<string, string> = {
  pi: "Math.PI",
  tau: "(2*Math.PI)",
  e: "Math.E",
};

function tokenize(src: string): Tok[] | string {
  const s = src
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/θ/g, "theta")
    .replace(/π/g, "pi");
  if (!s.trim()) return "Enter an expression.";
  if (s.length > 180) return "Expression is too long.";
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === " " || c === "\t" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "(") {
      out.push({ k: "lp" });
      i += 1;
      continue;
    }
    if (c === ")") {
      out.push({ k: "rp" });
      i += 1;
      continue;
    }
    if (c === ",") {
      out.push({ k: "comma" });
      i += 1;
      continue;
    }
    if ("+-*/^%".includes(c)) {
      out.push({ k: "op", v: c });
      i += 1;
      continue;
    }
    if (c === "." || (c >= "0" && c <= "9")) {
      const m = /^(\d*\.\d+|\d+\.?\d*)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) return "Bad number.";
      out.push({ k: "num", v: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
      out.push({ k: "id", v: m![0]!.toLowerCase() });
      i += m![0]!.length;
      continue;
    }
    return `Unexpected “${c}”.`;
  }
  return out;
}

function isFnName(name: string): boolean {
  return name in FN_JS || SPECIAL_FN.has(name);
}

function needsMul(a: Tok, b: Tok): boolean {
  const leftVal = a.k === "num" || a.k === "rp" || (a.k === "id" && !isFnName(a.v));
  const rightVal = b.k === "num" || b.k === "lp" || b.k === "id";
  if (!leftVal || !rightVal) return false;
  if (a.k === "id" && isFnName(a.v) && b.k === "lp") return false;
  return true;
}

function insertImplicit(tokens: Tok[]): Tok[] | string {
  const out: Tok[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const a = tokens[i]!;
    const b = tokens[i + 1];
    if (b && a.k === "id" && isFnName(a.v) && b.k !== "lp") {
      return `Use ${a.v}(…) with parentheses.`;
    }
    out.push(a);
    if (b && needsMul(a, b)) out.push({ k: "op", v: "*" });
  }
  return out;
}

function parseTokens(tokens: Tok[]): string {
  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  function fail(msg: string): never {
    throw new Error(msg);
  }

  function parseExpr(): string {
    let left = parseTerm();
    while (peek()?.k === "op") {
      const op = (peek() as { v: string }).v;
      if (op !== "+" && op !== "-") break;
      eat();
      left = `(${left}${op}${parseTerm()})`;
    }
    return left;
  }

  function parseTerm(): string {
    let left = parseUnary();
    while (peek()?.k === "op") {
      const op = (peek() as { v: string }).v;
      if (op !== "*" && op !== "/" && op !== "%") break;
      eat();
      left = `(${left}${op}${parseUnary()})`;
    }
    return left;
  }

  function parseUnary(): string {
    if (peek()?.k === "op" && (peek() as { v: string }).v === "-") {
      eat();
      return `(-${parseUnary()})`;
    }
    if (peek()?.k === "op" && (peek() as { v: string }).v === "+") {
      eat();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): string {
    const base = parsePrimary();
    if (peek()?.k === "op" && (peek() as { v: string }).v === "^") {
      eat();
      return `Math.pow(${base},${parseUnary()})`;
    }
    return base;
  }

  function parsePrimary(): string {
    const tok = peek();
    if (!tok) fail("Expression ended early.");
    if (tok.k === "num") {
      eat();
      return tok.v;
    }
    if (tok.k === "lp") {
      eat();
      const inner = parseExpr();
      if (peek()?.k !== "rp") fail("Missing “)”.");
      eat();
      return `(${inner})`;
    }
    if (tok.k === "id") {
      eat();
      const name = tok.v;
      if (peek()?.k === "lp") {
        eat();
        const args: string[] = [];
        if (peek()?.k !== "rp") {
          args.push(parseExpr());
          while (peek()?.k === "comma") {
            eat();
            args.push(parseExpr());
          }
        }
        if (peek()?.k !== "rp") fail("Missing “)”.");
        eat();
        return emitCall(name, args);
      }
      if (isFnName(name)) fail(`Use ${name}(…) with parentheses.`);
      if (VARS.has(name)) return name;
      if (name in CONST_JS) return CONST_JS[name]!;
      fail(`Unknown name “${name}”. Try x, y, t, r, theta, pi.`);
    }
    fail("Expected a number, name, or “(”.");
  }

  const js = parseExpr();
  if (i < tokens.length) fail("Unexpected extra characters.");
  return js;
}

function emitCall(name: string, args: string[]): string {
  const joined = args.join(",");
  if (name === "sec") {
    if (args.length !== 1) throw new Error("sec takes one argument.");
    return `(1/Math.cos(${joined}))`;
  }
  if (name === "csc") {
    if (args.length !== 1) throw new Error("csc takes one argument.");
    return `(1/Math.sin(${joined}))`;
  }
  if (name === "cot") {
    if (args.length !== 1) throw new Error("cot takes one argument.");
    return `(1/Math.tan(${joined}))`;
  }
  const mapped = FN_JS[name];
  if (!mapped) throw new Error(`Unknown function “${name}”.`);
  if (args.length === 0) throw new Error(`${name} needs an argument.`);
  return `${mapped}(${joined})`;
}

export function compileExpr(src: string): CompileResult {
  const tokens = tokenize(src);
  if (typeof tokens === "string") return { ok: false, error: tokens };
  const withMul = insertImplicit(tokens);
  if (typeof withMul === "string") return { ok: false, error: withMul };
  let js: string;
  try {
    js = parseTokens(withMul);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not parse expression.",
    };
  }
  try {
    const fn = new Function(
      "x",
      "y",
      "t",
      `"use strict"; const r = Math.hypot(x, y); const theta = Math.atan2(y, x); return (${js});`,
    ) as FieldFn;
    const probe = fn(0.3, -0.2, 0);
    if (typeof probe !== "number") {
      return { ok: false, error: "Expression must return a number." };
    }
    return { ok: true, fn, js };
  } catch {
    return { ok: false, error: "Could not evaluate expression." };
  }
}

export type VectorField = (x: number, y: number, t: number) => { vx: number; vy: number };

export function compileField(
  vxSrc: string,
  vySrc: string,
): {
  field: VectorField;
  errorVx?: string;
  errorVy?: string;
} {
  const cx = compileExpr(vxSrc);
  const cy = compileExpr(vySrc);
  const fx = cx.ok ? cx.fn : () => 0;
  const fy = cy.ok ? cy.fn : () => 0;
  return {
    field: (x, y, t) => {
      const vx = fx(x, y, t);
      const vy = fy(x, y, t);
      return {
        vx: Number.isFinite(vx) ? vx : 0,
        vy: Number.isFinite(vy) ? vy : 0,
      };
    },
    errorVx: cx.ok ? undefined : cx.error,
    errorVy: cy.ok ? undefined : cy.error,
  };
}

export function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

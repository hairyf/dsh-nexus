window.__ModuleLoader__.load({id:"dsh-nexus",factory:(require)=>{var module={exports:{}};var exports=module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_dom = require("react-dom");
let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
// src/config/constants.ts
/**
* Client-safe constants only: this module is bundled into the browser Client
* artifact, so it must never import Node builtins. Host-only paths live in
* `./paths`.
*/
const PANEL_ID = "dsh-nexus";
const NS = "dshNexus";
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
* @lightSyntaxTransform
* @noflow
* @nolint
* @preventMunge
* @preserve-invariant-messages
*/
// src/client/components/icons.tsx
var import_dist = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var index_exports = {};
	__export(index_exports, {
		$dispatcherGuard: () => $dispatcherGuard,
		$makeReadOnly: () => $makeReadOnly,
		$reset: () => $reset,
		$structuralCheck: () => $structuralCheck,
		c: () => c,
		clearRenderCounterRegistry: () => clearRenderCounterRegistry,
		renderCounterRegistry: () => renderCounterRegistry,
		useRenderCounter: () => useRenderCounter
	});
	module.exports = __toCommonJS(index_exports);
	var React = __toESM(require("react"));
	var { useRef, useEffect, isValidElement } = React;
	var _a;
	var ReactSecretInternals = (_a = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) != null ? _a : React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
	var $empty = Symbol.for("react.memo_cache_sentinel");
	var _a2;
	var c = typeof ((_a2 = React.__COMPILER_RUNTIME) == null ? void 0 : _a2.c) === "function" ? React.__COMPILER_RUNTIME.c : function c2(size) {
		return React.useMemo(() => {
			const $ = new Array(size);
			for (let ii = 0; ii < size; ii++) $[ii] = $empty;
			$[$empty] = true;
			return $;
		}, []);
	};
	var LazyGuardDispatcher = {};
	[
		"readContext",
		"useCallback",
		"useContext",
		"useEffect",
		"useImperativeHandle",
		"useInsertionEffect",
		"useLayoutEffect",
		"useMemo",
		"useReducer",
		"useRef",
		"useState",
		"useDebugValue",
		"useDeferredValue",
		"useTransition",
		"useMutableSource",
		"useSyncExternalStore",
		"useId",
		"unstable_isNewReconciler",
		"getCacheSignal",
		"getCacheForType",
		"useCacheRefresh"
	].forEach((name) => {
		LazyGuardDispatcher[name] = () => {
			throw new Error(`[React] Unexpected React hook call (${name}) from a React compiled function. Check that all hooks are called directly and named according to convention ('use[A-Z]') `);
		};
	});
	var originalDispatcher = null;
	LazyGuardDispatcher["useMemoCache"] = (count) => {
		if (originalDispatcher == null) throw new Error("React Compiler internal invariant violation: unexpected null dispatcher");
		else return originalDispatcher.useMemoCache(count);
	};
	function setCurrent(newDispatcher) {
		ReactSecretInternals.ReactCurrentDispatcher.current = newDispatcher;
		return ReactSecretInternals.ReactCurrentDispatcher.current;
	}
	var guardFrames = [];
	function $dispatcherGuard(kind) {
		const curr = ReactSecretInternals.ReactCurrentDispatcher.current;
		if (kind === 0) {
			guardFrames.push(curr);
			if (guardFrames.length === 1) originalDispatcher = curr;
			if (curr === LazyGuardDispatcher) throw new Error(`[React] Unexpected call to custom hook or component from a React compiled function. Check that (1) all hooks are called directly and named according to convention ('use[A-Z]') and (2) components are returned as JSX instead of being directly invoked.`);
			setCurrent(LazyGuardDispatcher);
		} else if (kind === 1) {
			const lastFrame = guardFrames.pop();
			if (lastFrame == null) throw new Error("React Compiler internal error: unexpected null in guard stack");
			if (guardFrames.length === 0) originalDispatcher = null;
			setCurrent(lastFrame);
		} else if (kind === 2) {
			guardFrames.push(curr);
			setCurrent(originalDispatcher);
		} else if (kind === 3) {
			const lastFrame = guardFrames.pop();
			if (lastFrame == null) throw new Error("React Compiler internal error: unexpected null in guard stack");
			setCurrent(lastFrame);
		} else throw new Error("React Compiler internal error: unreachable block" + kind);
	}
	function $reset($) {
		for (let ii = 0; ii < $.length; ii++) $[ii] = $empty;
	}
	function $makeReadOnly() {
		throw new Error("TODO: implement $makeReadOnly in react-compiler-runtime");
	}
	var renderCounterRegistry = /* @__PURE__ */ new Map();
	function clearRenderCounterRegistry() {
		for (const counters of renderCounterRegistry.values()) counters.forEach((counter) => {
			counter.count = 0;
		});
	}
	function registerRenderCounter(name, val) {
		let counters = renderCounterRegistry.get(name);
		if (counters == null) {
			counters = /* @__PURE__ */ new Set();
			renderCounterRegistry.set(name, counters);
		}
		counters.add(val);
	}
	function removeRenderCounter(name, val) {
		const counters = renderCounterRegistry.get(name);
		if (counters == null) return;
		counters.delete(val);
	}
	function useRenderCounter(name) {
		const val = useRef(null);
		if (val.current != null) val.current.count += 1;
		useEffect(() => {
			if (val.current == null) {
				const counter = { count: 0 };
				registerRenderCounter(name, counter);
				val.current = counter;
			}
			return () => {
				if (val.current !== null) removeRenderCounter(name, val.current);
			};
		});
	}
	var seenErrors = /* @__PURE__ */ new Set();
	function $structuralCheck(oldValue, newValue, variableName, fnName, kind, loc) {
		function error(l, r, path, depth) {
			const str = `${fnName}:${loc} [${kind}] ${variableName}${path} changed from ${l} to ${r} at depth ${depth}`;
			if (seenErrors.has(str)) return;
			seenErrors.add(str);
			console.error(str);
		}
		const depthLimit = 2;
		function recur(oldValue2, newValue2, path, depth) {
			if (depth > depthLimit) return;
			else if (oldValue2 === newValue2) return;
			else if (typeof oldValue2 !== typeof newValue2) error(`type ${typeof oldValue2}`, `type ${typeof newValue2}`, path, depth);
			else if (typeof oldValue2 === "object") {
				const oldArray = Array.isArray(oldValue2);
				const newArray = Array.isArray(newValue2);
				if (oldValue2 === null && newValue2 !== null) error("null", `type ${typeof newValue2}`, path, depth);
				else if (newValue2 === null) error(`type ${typeof oldValue2}`, "null", path, depth);
				else if (oldValue2 instanceof Map) {
					if (!(newValue2 instanceof Map)) error(`Map instance`, `other value`, path, depth);
					else if (oldValue2.size !== newValue2.size) error(`Map instance with size ${oldValue2.size}`, `Map instance with size ${newValue2.size}`, path, depth);
					else for (const [k, v] of oldValue2) if (!newValue2.has(k)) error(`Map instance with key ${k}`, `Map instance without key ${k}`, path, depth);
					else recur(v, newValue2.get(k), `${path}.get(${k})`, depth + 1);
				} else if (newValue2 instanceof Map) error("other value", `Map instance`, path, depth);
				else if (oldValue2 instanceof Set) {
					if (!(newValue2 instanceof Set)) error(`Set instance`, `other value`, path, depth);
					else if (oldValue2.size !== newValue2.size) error(`Set instance with size ${oldValue2.size}`, `Set instance with size ${newValue2.size}`, path, depth);
					else for (const v of newValue2) if (!oldValue2.has(v)) error(`Set instance without element ${v}`, `Set instance with element ${v}`, path, depth);
				} else if (newValue2 instanceof Set) error("other value", `Set instance`, path, depth);
				else if (oldArray || newArray) {
					if (oldArray !== newArray) error(`type ${oldArray ? "array" : "object"}`, `type ${newArray ? "array" : "object"}`, path, depth);
					else if (oldValue2.length !== newValue2.length) error(`array with length ${oldValue2.length}`, `array with length ${newValue2.length}`, path, depth);
					else for (let ii = 0; ii < oldValue2.length; ii++) recur(oldValue2[ii], newValue2[ii], `${path}[${ii}]`, depth + 1);
				} else if (isValidElement(oldValue2) || isValidElement(newValue2)) {
					if (isValidElement(oldValue2) !== isValidElement(newValue2)) error(`type ${isValidElement(oldValue2) ? "React element" : "object"}`, `type ${isValidElement(newValue2) ? "React element" : "object"}`, path, depth);
					else if (oldValue2.type !== newValue2.type) error(`React element of type ${oldValue2.type}`, `React element of type ${newValue2.type}`, path, depth);
					else recur(oldValue2.props, newValue2.props, `[props of ${path}]`, depth + 1);
				} else {
					for (const key in newValue2) if (!(key in oldValue2)) error(`object without key ${key}`, `object with key ${key}`, path, depth);
					for (const key in oldValue2) if (!(key in newValue2)) error(`object with key ${key}`, `object without key ${key}`, path, depth);
					else recur(oldValue2[key], newValue2[key], `${path}.${key}`, depth + 1);
				}
			} else if (typeof oldValue2 === "function") return;
			else if (isNaN(oldValue2) || isNaN(newValue2)) {
				if (isNaN(oldValue2) !== isNaN(newValue2)) error(`${isNaN(oldValue2) ? "NaN" : "non-NaN value"}`, `${isNaN(newValue2) ? "NaN" : "non-NaN value"}`, path, depth);
			} else if (oldValue2 !== newValue2) error(oldValue2, newValue2, path, depth);
		}
		recur(oldValue, newValue, "", 0);
	}
	0 && (module.exports = {
		$dispatcherGuard,
		$makeReadOnly,
		$reset,
		$structuralCheck,
		c,
		clearRenderCounterRegistry,
		renderCounterRegistry,
		useRenderCounter
	});
})))();
function ChannelsIcon(props) {
	const $ = (0, import_dist.c)(9);
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	let t6;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.9 16.1C1 12.2 1 5.8 4.9 1.9" });
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" });
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "9",
			r: "2"
		});
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M16.2 4.8c2 2 2.26 5.11.8 7.47" });
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19.1 1.9a9.96 9.96 0 0 1 0 14.1" });
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9.5 18h5" });
		t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m8 22 4-11 4 11" });
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
		$[3] = t3;
		$[4] = t4;
		$[5] = t5;
		$[6] = t6;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
		t3 = $[3];
		t4 = $[4];
		t5 = $[5];
		t6 = $[6];
	}
	let t7;
	if ($[7] !== props) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2,
				t3,
				t4,
				t5,
				t6
			]
		});
		$[7] = props;
		$[8] = t7;
	} else t7 = $[8];
	return t7;
}
function TasksIcon(props) {
	const $ = (0, import_dist.c)(7);
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 5h8" });
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 12h8" });
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 19h8" });
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m3 17 2 2 4-4" });
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m3 7 2 2 4-4" });
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
		$[3] = t3;
		$[4] = t4;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
		t3 = $[3];
		t4 = $[4];
	}
	let t5;
	if ($[5] !== props) {
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2,
				t3,
				t4
			]
		});
		$[5] = props;
		$[6] = t5;
	} else t5 = $[6];
	return t5;
}
function AgentIcon(props) {
	const $ = (0, import_dist.c)(8);
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 8V4H8" });
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
			width: "16",
			height: "12",
			x: "4",
			y: "8",
			rx: "2"
		});
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 14h2" });
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M20 14h2" });
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M15 13v2" });
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 13v2" });
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
		$[3] = t3;
		$[4] = t4;
		$[5] = t5;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
		t3 = $[3];
		t4 = $[4];
		t5 = $[5];
	}
	let t6;
	if ($[6] !== props) {
		t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2,
				t3,
				t4,
				t5
			]
		});
		$[6] = props;
		$[7] = t6;
	} else t6 = $[7];
	return t6;
}
function ZoomInIcon(props) {
	const $ = (0, import_dist.c)(6);
	let t0;
	let t1;
	let t2;
	let t3;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "11",
			cy: "11",
			r: "8"
		});
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "21",
			x2: "16.65",
			y1: "21",
			y2: "16.65"
		});
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "11",
			x2: "11",
			y1: "8",
			y2: "14"
		});
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "8",
			x2: "14",
			y1: "11",
			y2: "11"
		});
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
		$[3] = t3;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
		t3 = $[3];
	}
	let t4;
	if ($[4] !== props) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2,
				t3
			]
		});
		$[4] = props;
		$[5] = t4;
	} else t4 = $[5];
	return t4;
}
function ZoomOutIcon(props) {
	const $ = (0, import_dist.c)(5);
	let t0;
	let t1;
	let t2;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "11",
			cy: "11",
			r: "8"
		});
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "21",
			x2: "16.65",
			y1: "21",
			y2: "16.65"
		});
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "8",
			x2: "14",
			y1: "11",
			y2: "11"
		});
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
	}
	let t3;
	if ($[3] !== props) {
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2
			]
		});
		$[3] = props;
		$[4] = t3;
	} else t3 = $[4];
	return t3;
}
function FitViewIcon(props) {
	const $ = (0, import_dist.c)(6);
	let t0;
	let t1;
	let t2;
	let t3;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 7V5a2 2 0 0 1 2-2h2" });
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M17 3h2a2 2 0 0 1 2 2v2" });
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 17v2a2 2 0 0 1-2 2h-2" });
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 21H5a2 2 0 0 1-2-2v-2" });
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
		$[3] = t3;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
		t3 = $[3];
	}
	let t4;
	if ($[4] !== props) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2,
				t3
			]
		});
		$[4] = props;
		$[5] = t4;
	} else t4 = $[5];
	return t4;
}
function NexusIcon(props) {
	const $ = (0, import_dist.c)(5);
	let t0;
	let t1;
	let t2;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
			width: "8",
			height: "8",
			x: "3",
			y: "3",
			rx: "2"
		});
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 11v4a2 2 0 0 0 2 2h4" });
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
			width: "8",
			height: "8",
			x: "13",
			y: "13",
			rx: "2"
		});
		$[0] = t0;
		$[1] = t1;
		$[2] = t2;
	} else {
		t0 = $[0];
		t1 = $[1];
		t2 = $[2];
	}
	let t3;
	if ($[3] !== props) {
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: 24,
			height: 24,
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			...props,
			children: [
				t0,
				t1,
				t2
			]
		});
		$[3] = props;
		$[4] = t3;
	} else t3 = $[4];
	return t3;
}
// node_modules/.pnpm/@reause+shared@0.1.9_react@18.3.1/node_modules/@reause/shared/dist/index.js
function promiseTimeout(ms, throwOnTimeout = false, reason = "Timeout") {
	return new Promise((resolve, reject) => {
		if (throwOnTimeout) setTimeout(reject, ms, reason);
		else setTimeout(resolve, ms);
	});
}
function toArray(value) {
	return Array.isArray(value) ? value : [value];
}
const assert = (condition, ...infos) => {
	if (!condition) console.warn(...infos);
};
const toString$1 = Object.prototype.toString;
const isObject = (val) => toString$1.call(val) === "[object Object]";
function toValue(value) {
	if (Array.isArray(value) && value.length === 2 && typeof value[1] === "function") return value[0];
	if (value !== null && value !== void 0 && typeof value === "object" && "value" in value && !("addEventListener" in value)) return value.value;
	if (typeof value === "function") return value();
	return value;
}
function isTuple(state) {
	return Array.isArray(state) && state.length === 2 && typeof state[1] === "function";
}
function isObjectState$1(state) {
	return typeof state === "object" && state !== null && !Array.isArray(state) && "value" in state;
}
/**
* Combine controlled and uncontrolled state sources.
*
*/
function useControllableState(state, options = {}) {
	const { defaultValue, shouldUpdate = (prev, next) => !Object.is(prev, next), passive = false } = options;
	const controlled = isTuple(state) || isObjectState$1(state) || !passive;
	const externalValue = toValue(state);
	const initial = defaultValue === void 0 ? externalValue : typeof defaultValue === "function" ? defaultValue() : defaultValue;
	const [internal, setInternal] = (0, react.useState)(initial);
	const value = controlled ? externalValue : internal;
	const valueRef = (0, react.useRef)(value);
	const previousExternalRef = (0, react.useRef)(externalValue);
	valueRef.current = value;
	const stateRef = (0, react.useRef)(state);
	stateRef.current = state;
	(0, react.useEffect)(() => {
		if (passive && (typeof state === "function" || externalValue === null || typeof externalValue !== "object") && !isTuple(state) && !isObjectState$1(state) && !Object.is(previousExternalRef.current, externalValue) && shouldUpdate(valueRef.current, externalValue)) setInternal(externalValue);
		previousExternalRef.current = externalValue;
	}, [
		externalValue,
		passive,
		shouldUpdate
	]);
	return [value, (0, react.useCallback)((action) => {
		var _currentState$onChang;
		const prev = valueRef.current;
		const next = typeof action === "function" ? action(prev) : action;
		if (!shouldUpdate(prev, next)) return;
		const currentState = stateRef.current;
		if (isTuple(currentState)) currentState[1](next);
		else if (isObjectState$1(currentState)) (_currentState$onChang = currentState.onChange) === null || _currentState$onChang === void 0 || _currentState$onChang.call(currentState, next);
		else if (!controlled) setInternal(next);
		else assert(false, "useControllableState: `setValue` on a controlled source without a write channel (a plain value or getter with `passive: false`) is ignored. Pass a [value, setter] tuple, a { value, onChange } pair, or use `passive: true`.");
	}, [controlled, shouldUpdate])];
}
/**
* Map from @vueuse/shared `useIntervalFn`.
*
* @example
* const { isActive, pause, resume } = useIntervalFn(() => { ... }, 1000)
*/
function useIntervalFn(cb, interval = 1e3, options = {}) {
	const { immediate = true, immediateCallback = false } = options;
	const [isActive, setIsActive] = (0, react.useState)(false);
	const isActiveRef = (0, react.useRef)(false);
	const cbRef = (0, react.useRef)(cb);
	const intervalRef = (0, react.useRef)(interval);
	const immediateCallbackRef = (0, react.useRef)(immediateCallback);
	const timerRef = (0, react.useRef)(null);
	cbRef.current = cb;
	intervalRef.current = interval;
	immediateCallbackRef.current = immediateCallback;
	const immediateRef = (0, react.useRef)(immediate);
	function clean() {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}
	function setActive(active) {
		isActiveRef.current = active;
		setIsActive(active);
	}
	const pause = (0, react.useCallback)(() => {
		setActive(false);
		clean();
	}, []);
	const resume = (0, react.useCallback)(() => {
		const intervalValue = intervalRef.current;
		if (intervalValue <= 0) return;
		setActive(true);
		if (immediateCallbackRef.current) cbRef.current();
		clean();
		if (isActiveRef.current) timerRef.current = setInterval(() => cbRef.current(), intervalValue);
	}, []);
	(0, react.useEffect)(() => {
		if (immediateRef.current) resume();
		return () => {
			clean();
		};
	}, [resume]);
	const mountedRef = (0, react.useRef)(false);
	(0, react.useEffect)(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			return;
		}
		if (isActiveRef.current) resume();
	}, [interval, resume]);
	return {
		isActive,
		pause,
		resume
	};
}
Map.prototype;
/**
* Map from react-use `useUnmount`.
*
* @example
* useUnmount(() => cleanup())
*/
function useUnmount(fn) {
	const fnRef = (0, react.useRef)(fn);
	fnRef.current = fn;
	(0, react.useEffect)(() => () => fnRef.current(), []);
}
Set.prototype;
function noop() {}
// node_modules/.pnpm/@reause+core@0.1.9_react@18.3.1/node_modules/@reause/core/dist/index.js
/**
* Resolve the target argument into the flat list of targets to bind: a ref holding an array
* contributes its members, an array of refs contributes each ref's `current`, and a single ref
* contributes its `current`.
*/
function resolveTargets$3(target) {
	if (target === void 0) return [];
	const items = Array.isArray(target) ? target : [target];
	const resolved = [];
	for (const item of items) {
		const value = item.current;
		if (Array.isArray(value)) resolved.push(...value.filter((entry) => entry != null));
		else if (value != null) resolved.push(value);
	}
	return resolved;
}
function register(el, event, listener, options) {
	el.addEventListener(event, listener, options);
	return () => el.removeEventListener(event, listener, options);
}
function sameValues(a, b) {
	return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}
/**
* Order-insensitive, identity-aware equality for the resolved options — the React equivalent of
* upstream's reactive comparison. Key order differences must not re-bind (a `JSON.stringify`
* comparison would), while identity changes of non-plain values (e.g. a new `AbortSignal`) must.
*/
function sameOptions(a, b) {
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return Object.is(a, b);
	if (!isObject(a) || !isObject(b)) return Object.is(a, b);
	const aKeys = Object.keys(a).sort();
	if (!sameValues(aKeys, Object.keys(b).sort())) return false;
	return aKeys.every((key) => Object.is(a[key], b[key]));
}
function useEventListener(...args) {
	const firstArg = args[0];
	const isTargetFirst = !(typeof firstArg === "string" || Array.isArray(firstArg) && firstArg.every((entry) => typeof entry === "string"));
	const eventArg = isTargetFirst ? args[1] : args[0];
	const listenerArg = isTargetFirst ? args[2] : args[1];
	const optionsArg = isTargetFirst ? args[3] : args[2];
	const win = typeof window === "undefined" ? void 0 : window;
	const listenerRef = (0, react.useRef)(listenerArg);
	listenerRef.current = listenerArg;
	const cleanupRef = (0, react.useRef)(null);
	const lastBindRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		var _cleanupRef$current;
		const targets = isTargetFirst ? resolveTargets$3(args[0]) : win ? [win] : [];
		const events = toArray(eventArg);
		const options = optionsArg;
		const listenerCount = toArray(listenerArg).length;
		const last = lastBindRef.current;
		if (last !== null && sameValues(last.targets, targets) && sameValues(last.events, events) && sameOptions(last.options, options) && last.listenerCount === listenerCount) return;
		(_cleanupRef$current = cleanupRef.current) === null || _cleanupRef$current === void 0 || _cleanupRef$current.call(cleanupRef);
		cleanupRef.current = null;
		lastBindRef.current = {
			targets,
			events,
			options,
			listenerCount
		};
		if (!targets.length || !events.length || !listenerCount) return;
		const optionsClone = isObject(options) ? { ...options } : options;
		const dispatch = (event) => {
			for (const listener of toArray(listenerRef.current)) listener.call(event.currentTarget, event);
		};
		const cleanups = targets.flatMap((el) => events.map((event) => register(el, event, dispatch, optionsClone)));
		cleanupRef.current = () => cleanups.forEach((fn) => fn());
	});
	useUnmount(() => {
		var _cleanupRef$current2;
		(_cleanupRef$current2 = cleanupRef.current) === null || _cleanupRef$current2 === void 0 || _cleanupRef$current2.call(cleanupRef);
		cleanupRef.current = null;
		lastBindRef.current = null;
	});
	return (0, react.useCallback)(() => {
		var _cleanupRef$current3;
		(_cleanupRef$current3 = cleanupRef.current) === null || _cleanupRef$current3 === void 0 || _cleanupRef$current3.call(cleanupRef);
		cleanupRef.current = null;
	}, []);
}
/**
* Default `onError` — mirrors upstream's `globalThis.reportError` fallback. `reportError` must be
* invoked with the global object as `this`, otherwise Chromium throws "Illegal invocation" for a
* detached call.
*/
function defaultOnError$3(e) {
	if (typeof globalThis.reportError === "function") globalThis.reportError(e);
}
function isPromiseLike(value) {
	return typeof (value === null || value === void 0 ? void 0 : value.then) === "function";
}
const EMPTY_DEPS = [];
function useAsync(evaluationCallback, initialState, options) {
	const { deps = EMPTY_DEPS, skipInitial: skipInitialOption, lazy = false, onEvaluating = noop, onError = defaultOnError$3 } = options !== null && options !== void 0 ? options : {};
	const skipInitial = skipInitialOption !== null && skipInitialOption !== void 0 ? skipInitialOption : lazy;
	const [state, setState] = useControllableState(initialState, { passive: true });
	const evaluationCallbackRef = (0, react.useRef)(evaluationCallback);
	evaluationCallbackRef.current = evaluationCallback;
	const skipInitialRef = (0, react.useRef)(skipInitial);
	skipInitialRef.current = skipInitial;
	const onEvaluatingRef = (0, react.useRef)(onEvaluating);
	onEvaluatingRef.current = onEvaluating;
	const onErrorRef = (0, react.useRef)(onError);
	onErrorRef.current = onError;
	const evaluationIdRef = (0, react.useRef)(0);
	const isMountedRef = (0, react.useRef)(true);
	const hasEvaluatedRef = (0, react.useRef)(false);
	(0, react.useEffect)(() => {
		const isFirstRun = !hasEvaluatedRef.current;
		hasEvaluatedRef.current = true;
		if (isFirstRun && skipInitialRef.current) return;
		const id = evaluationIdRef.current += 1;
		let hasFinished = false;
		let settled = false;
		const cancelCallbacks = [];
		const settle = () => {
			if (settled || !isMountedRef.current) return;
			settled = true;
			onEvaluatingRef.current(false);
		};
		const invalidate = () => {
			settle();
			if (!hasFinished) cancelCallbacks.splice(0, cancelCallbacks.length).forEach((cancelCallback) => cancelCallback());
		};
		onEvaluatingRef.current(true);
		try {
			const result = evaluationCallbackRef.current((cancelCallback) => {
				cancelCallbacks.push(cancelCallback);
			});
			if (isPromiseLike(result)) result.then((value) => {
				hasFinished = true;
				if (id === evaluationIdRef.current && isMountedRef.current) setState(value);
				settle();
			}, (error) => {
				hasFinished = true;
				onErrorRef.current(error);
				settle();
			});
			else {
				hasFinished = true;
				setState(result);
				settle();
			}
		} catch (error) {
			hasFinished = true;
			onErrorRef.current(error);
			settle();
		}
		return invalidate;
	}, deps);
	(0, react.useEffect)(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);
	return state;
}
/**
* Default `onError` — mirrors upstream's `globalThis.reportError` fallback. `reportError` must be
* invoked with the global object as `this`, otherwise Chromium throws "Illegal invocation" for a
* detached call.
*/
function defaultOnError$2(e) {
	if (typeof globalThis.reportError === "function") globalThis.reportError(e);
}
/**
* Map from @vueuse/core `useAsyncState`
* (`source/vueuse/packages/core/useAsyncState/`).
*
* @example
* const { state, setState, isReady, isLoading, error, execute } = useAsyncState(
*   fetchData,
*   initialData,
* )
* // pass `immediate: false` and call `execute()` manually instead
* setState(nextData) // write `state` without re-executing
*
* @see https://vueuse.org/core/useAsyncState/
*/
function useAsyncState(promise, initialState, options) {
	const { immediate = true, delay = 0, onError = defaultOnError$2, onSuccess = noop, resetOnExecute = true, throwError } = options || {};
	const [state, setStateInternal] = (0, react.useState)(() => initialState);
	const [isReady, setIsReady] = (0, react.useState)(false);
	const [isLoading, setIsLoading] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(void 0);
	const promiseRef = (0, react.useRef)(promise);
	promiseRef.current = promise;
	const initialStateRef = (0, react.useRef)(initialState);
	initialStateRef.current = initialState;
	const delayRef = (0, react.useRef)(delay);
	delayRef.current = delay;
	const immediateRef = (0, react.useRef)(immediate);
	immediateRef.current = immediate;
	const resetOnExecuteRef = (0, react.useRef)(resetOnExecute);
	resetOnExecuteRef.current = resetOnExecute;
	const throwErrorRef = (0, react.useRef)(!!throwError);
	throwErrorRef.current = !!throwError;
	const onSuccessRef = (0, react.useRef)(onSuccess);
	onSuccessRef.current = onSuccess;
	const onErrorRef = (0, react.useRef)(onError);
	onErrorRef.current = onError;
	const liveRef = (0, react.useRef)({
		state,
		isReady,
		isLoading,
		error
	});
	const executionsCountRef = (0, react.useRef)(0);
	const loadingRef = (0, react.useRef)(false);
	const waitersRef = (0, react.useRef)([]);
	const setState = (0, react.useCallback)((action) => {
		const prev = liveRef.current.state;
		const next = typeof action === "function" ? action(prev) : action;
		liveRef.current.state = next;
		setStateInternal(next);
	}, []);
	const execute = (0, react.useCallback)((delay = 0, ...args) => {
		const executionId = executionsCountRef.current += 1;
		const nextState = resetOnExecuteRef.current ? initialStateRef.current : liveRef.current.state;
		if (resetOnExecuteRef.current) setStateInternal(nextState);
		liveRef.current = {
			state: nextState,
			isReady: false,
			isLoading: true,
			error: void 0
		};
		setError(void 0);
		setIsReady(false);
		loadingRef.current = true;
		setIsLoading(true);
		return (async () => {
			if (delay > 0) await promiseTimeout(delay);
			const pending = typeof promiseRef.current === "function" ? promiseRef.current(...args) : promiseRef.current;
			try {
				const data = await pending;
				if (executionId === executionsCountRef.current) {
					setStateInternal(data);
					setIsReady(true);
					liveRef.current.state = data;
					liveRef.current.isReady = true;
				}
				onSuccessRef.current(data);
				return data;
			} catch (e) {
				if (executionId === executionsCountRef.current) {
					setError(e);
					liveRef.current.error = e;
				}
				onErrorRef.current(e);
				if (throwErrorRef.current) throw e;
				return;
			} finally {
				if (executionId === executionsCountRef.current) {
					loadingRef.current = false;
					setIsLoading(false);
					liveRef.current.isLoading = false;
				}
			}
		})();
	}, []);
	const base = {
		get state() {
			return liveRef.current.state;
		},
		get isReady() {
			return liveRef.current.isReady;
		},
		get isLoading() {
			return liveRef.current.isLoading;
		},
		get error() {
			return liveRef.current.error;
		},
		setState,
		execute,
		executeImmediate: (0, react.useCallback)((...args) => execute(0, ...args), [execute])
	};
	const baseRef = (0, react.useRef)(base);
	baseRef.current = base;
	const waitUntilIsLoaded = (0, react.useCallback)(() => {
		return new Promise((resolve) => {
			if (!loadingRef.current) {
				resolve(baseRef.current);
				return;
			}
			waitersRef.current.push({ resolve });
		});
	}, []);
	(0, react.useEffect)(() => {
		if (immediateRef.current) execute(delayRef.current);
	}, [execute]);
	(0, react.useEffect)(() => {
		if (isLoading) return;
		const waiters = waitersRef.current;
		waitersRef.current = [];
		waiters.forEach((waiter) => waiter.resolve(baseRef.current));
	}, [isLoading]);
	const shell = Object.create(base);
	shell.then = function then(onFulfilled, onRejected) {
		return waitUntilIsLoaded().then(onFulfilled, onRejected);
	};
	return shell;
}
(0, react.createContext)(void 0);
/mac|iphone|ipod|ipad/i.test(typeof navigator === "undefined" ? "" : navigator.platform);
// src/client/apis/nexus.ts
async function request(path, method = "GET", body, signal) {
	const response = await fetch("api/nexus/dispatch", {
		method: "POST",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			path,
			method,
			body
		}),
		signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15e3)]) : AbortSignal.timeout(15e3)
	});
	const text = await response.text();
	let value = null;
	try {
		value = JSON.parse(text);
	} catch {
		if (response.ok) throw new Error("Nexus 服务返回了无效数据，请重试并检查宿主插件状态。");
	}
	if (!response.ok) {
		if (response.status === 404 && !value?.data?.code && !value?.message) throw new Error("Nexus 服务接口未就绪（HTTP 404），请确认宿主插件已启用并完成初始化。");
		throw new Error(value?.data?.code ?? value?.message ?? `HTTP ${response.status}`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Nexus 服务返回了无效数据，请重试并检查宿主插件状态。");
	return value;
}
const nexus = {
	read: () => request("panel"),
	mailbox: (id, signal) => request(`sessions/${encodeURIComponent(id)}/mailbox`, "GET", void 0, signal),
	ticket: (id) => request(`tickets/${encodeURIComponent(id)}`),
	context: (id) => request(`sessions/${encodeURIComponent(id)}/context`),
	answer: (input) => {
		const { askId, ...body } = input;
		return request(`asks/${encodeURIComponent(askId)}/answers`, "POST", body);
	},
	command: (id, action, reason) => request(`tickets/${encodeURIComponent(id)}/${action}`, "POST", { reason }),
	policy: (id, policy, reason) => request(`tickets/${encodeURIComponent(id)}`, "PATCH", {
		...policy,
		reason
	}),
	settings: (patch) => request("settings", "PATCH", patch),
	project: (id, enabled) => request(`projects/${encodeURIComponent(id)}`, "PATCH", { enabled }),
	refreshProjects: () => request("projects/refresh", "POST", {})
};
// src/client/components/mailbox.tsx
function Mailbox(props) {
	const $ = (0, import_dist.c)(2);
	let t0;
	if ($[0] !== props) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionMailbox, { ...props }, props.sessionId);
		$[0] = props;
		$[1] = t0;
	} else t0 = $[1];
	return t0;
}
function SessionMailbox({ sessionId, useSession, t }) {
	const running = useSession((session) => session.running);
	const [revision, setRevision] = (0, react.useState)(0);
	const [collapsed, setCollapsed] = (0, react.useState)(true);
	const [selected, setSelected] = (0, react.useState)(null);
	const lastModel = (0, react.useRef)(null);
	const pending = (0, react.useRef)(null);
	const listId = (0, react.useId)();
	const refresh = () => setRevision((value) => value + 1);
	const result = useAsync(async (onCancel) => {
		const abort = new AbortController();
		pending.current = abort;
		onCancel(() => abort.abort());
		try {
			const model = await nexus.mailbox(sessionId, abort.signal);
			if (!abort.signal.aborted) lastModel.current = model;
			return {
				model,
				error: ""
			};
		} catch (error) {
			return {
				model: lastModel.current,
				error: error instanceof Error ? error.message : String(error)
			};
		} finally {
			if (pending.current === abort) pending.current = null;
		}
	}, {
		model: null,
		error: ""
	}, { deps: [
		sessionId,
		running,
		revision
	] });
	useEventListener("online", refresh);
	useEventListener("focus", refresh);
	useIntervalFn(() => {
		if (document.visibilityState === "visible" && !pending.current && (result.model?.active || result.error)) refresh();
	}, 5e3);
	if (!result.model?.active || !result.error && result.model.pendingCount === 0 && !selected) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "nexus-mailbox-root",
		"data-testid": "agent-mailbox",
		"aria-label": t("mailboxTitle"),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "nexus-mailbox-body",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "nexus-mailbox-header",
					"aria-expanded": !collapsed,
					"aria-controls": listId,
					onClick: () => setCollapsed((value_0) => !value_0),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "nexus-mailbox-lead",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "nexus-mailbox-title",
							children: t("mailboxTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "nexus-mailbox-progress",
							children: result.error ? t("mailboxReadFailed") : t("mailboxPending", { count: result.model.pendingCount })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "nexus-mailbox-chevron",
							"aria-hidden": "true",
							children: collapsed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
						})
					]
				}),
				result.error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "alert",
					className: "nexus-mailbox-letter",
					children: [result.error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: refresh,
						children: t("mailboxRetry")
					})]
				}),
				!collapsed && result.model?.active && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					id: listId,
					className: "nexus-mailbox-list",
					children: result.model.messages.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
						className: "nexus-mailbox-item",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "nexus-mailbox-message",
							onClick: () => setSelected(message),
							"aria-label": t("mailboxOpen", {
								sender: message.sender,
								content: (message.title || message.content).slice(0, 80)
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "nexus-mailbox-glyph",
								role: "img",
								"aria-label": t("mailboxUnhandled"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "idle" })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "nexus-mailbox-content",
								children: [
									message.sender,
									" ",
									"·",
									" ",
									message.content
								]
							})]
						})
					}, message.id))
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
			open: selected !== null,
			title: t("mailboxTitle"),
			description: selected ? `${selected.sender} · ${new Date(selected.acceptedAt).toLocaleString()}` : void 0,
			closeLabel: t("mailboxClose"),
			onClose: () => setSelected(null),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "nexus-mailbox-letter",
					children: selected?.content
				}),
				selected && !result.model.messages.some((message_0) => message_0.id === selected.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "nexus-mailbox-letter",
					children: t("mailboxNoLongerPending")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "nexus-mailbox-letter",
					children: t("mailboxReadOnly")
				})
			]
		})]
	});
}
// src/client/config/context.ts
const PluginContext = (0, react.createContext)({
	ctx: {},
	t: noop,
	useStore: {},
	actions: {}
});
// src/client/locale/index.ts
const dicts = {
	zh: {
		panel: "Nexus",
		title: "Nexus",
		desc: "项目、工单与本人待决事项",
		tabsLabel: "面板分区",
		mailboxTitle: "Agent 信箱",
		mailboxPending: "{count} 封待处理",
		mailboxUnhandled: "未处理",
		mailboxReadFailed: "读取失败，不代表没有信件",
		mailboxRetry: "重试",
		mailboxOpen: "阅读 {sender} 的信件：{content}",
		mailboxClose: "关闭信件",
		mailboxNoLongerPending: "此信件已处理或已撤销，不再属于待处理信件。",
		mailboxReadOnly: "仅阅读信件，不会将其标为已处理。",
		tabOverview: "概览",
		tabTickets: "工单",
		tabTriggers: "来源",
		tabChannels: "渠道",
		tabSettings: "设置",
		graphTitle: "编排关系",
		graphSupervisor: "临时协调",
		graphWaiting: "等待",
		graphZoomOut: "缩小",
		graphZoomIn: "放大",
		graphFit: "适应视图",
		graphHint: "方向键平移，+ / - 缩放，Home 复位；Tab 进入节点",
		graphFlow: "责任流",
		graphAssociation: "关联",
		graphDependency: "依赖",
		overviewOpenDetails: "查看工单"
	},
	en: {
		panel: "Nexus",
		title: "Nexus",
		desc: "Projects, tickets and decisions waiting for you",
		tabsLabel: "Panel sections",
		mailboxTitle: "Agent mailbox",
		mailboxPending: "{count} pending",
		mailboxUnhandled: "Unhandled",
		mailboxReadFailed: "Read failed; mail may still be pending",
		mailboxRetry: "Retry",
		mailboxOpen: "Read mail from {sender}: {content}",
		mailboxClose: "Close mail",
		mailboxNoLongerPending: "This message has been handled or withdrawn and is no longer pending.",
		mailboxReadOnly: "Reading a message does not mark it as handled.",
		tabOverview: "Overview",
		tabTickets: "Tickets",
		tabTriggers: "Sources",
		tabChannels: "Channels",
		tabSettings: "Settings",
		graphTitle: "Orchestration",
		graphSupervisor: "Temporary supervisor",
		graphWaiting: "Waiting",
		graphZoomOut: "Zoom out",
		graphZoomIn: "Zoom in",
		graphFit: "Fit view",
		graphHint: "Arrow keys pan, + / - zoom, Home resets; Tab enters nodes",
		graphFlow: "Responsibility",
		graphAssociation: "Association",
		graphDependency: "Dependency",
		overviewOpenDetails: "Open ticket"
	}
};
// src/client/hooks/use-dsh-context.ts
/**
* DSH 客户端上下文。
* @returns 插件拿到的那份 Client Cordis 上下文。
*/
function useDshContext() {
	return (0, react.useContext)(PluginContext).ctx;
}
// src/client/hooks/use-store.ts
/**
* 从面板 store 里选一片状态。
* @param select - 状态选择器，拿到的就是复合状态。
* @returns 选中的值，按 Object.is 比较。
*/
function useStore(select) {
	return (0, react.useContext)(PluginContext).useStore(select);
}
/**
* 面板 store 的写侧。
* @returns 官方烘焙过的动作集，形参已去掉 draft。
*/
function useActions() {
	return (0, react.useContext)(PluginContext).actions;
}
// src/client/hooks/use-navigation.ts
function usePage() {
	return useStore(_temp$12);
}
function _temp$12(state) {
	return state.navigation.page;
}
function useNavigate() {
	return useActions().go;
}
// src/client/hooks/use-panel.ts
const RefreshContext = (0, react.createContext)(async () => {});
function usePanel() {
	const $ = (0, import_dist.c)(3);
	const data = useStore(_temp$11);
	const t0 = (0, react.useContext)(RefreshContext);
	let t1;
	if ($[0] !== data || $[1] !== t0) {
		t1 = {
			data,
			refresh: t0
		};
		$[0] = data;
		$[1] = t0;
		$[2] = t1;
	} else t1 = $[2];
	return t1;
}
function _temp$11(state) {
	return state.model;
}
function useCommand() {
	const { refresh } = usePanel();
	const lock = (0, react.useRef)(false);
	const [busy, setBusy] = (0, react.useState)(false);
	const [feedback, setFeedback] = (0, react.useState)("");
	const [error, setError] = (0, react.useState)("");
	async function run(label, operation, success = "保存已受理。") {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setFeedback(`${label}…`);
		setError("");
		try {
			const result = await operation();
			setFeedback(typeof result === "string" ? result : success);
			await refresh();
		} catch (error_0) {
			setFeedback("");
			setError(`${label}失败：${error_0 instanceof Error ? error_0.message : String(error_0)}。输入已保留，请核对后重试。`);
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}
	return {
		run,
		busy,
		feedback,
		error
	};
}
// src/client/hooks/use-translation.ts
/**
* 面板命名空间的翻译函数。
* @returns 绑定到 `dshNexus` 的 `t`。
*/
function useTranslation() {
	const $ = (0, import_dist.c)(2);
	const t0 = (0, react.useContext)(PluginContext);
	let t1;
	if ($[0] !== t0.t) {
		t1 = { t: t0.t };
		$[0] = t0.t;
		$[1] = t1;
	} else t1 = $[1];
	return t1;
}
// src/client/pages/channel/detail/page.tsx
function ChannelDetail() {
	const $ = (0, import_dist.c)(8);
	const { data } = usePanel();
	const { go } = useActions();
	const id = useStore(_temp$10);
	let t0;
	if ($[0] !== data.channels || $[1] !== go || $[2] !== id) {
		let t1;
		if ($[4] !== id) {
			t1 = (item) => item.projectId === id;
			$[4] = id;
			$[5] = t1;
		} else t1 = $[5];
		const channel = data.channels.find(t1);
		let t2;
		if ($[6] !== go) {
			t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => go("channel"),
				children: "返回渠道"
			}) });
			$[6] = go;
			$[7] = t2;
		} else t2 = $[7];
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex min-w-0 flex-col gap-4",
			children: [t2, channel ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
					className: "m-0 text-lg font-medium",
					children: ["GitHub ·", channel.name]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
					tone: channel.available ? "success" : "warning",
					children: channel.available ? "最近核验可用" : channel.reason
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "m-0 text-xs",
					children: [
						"仓库：",
						channel.repository ?? "待核验",
						"。不可用时请在宿主修复 gh 环境或项目范围，再由宿主重新核验。刷新本页只读取事实，不伪造连接。"
					]
				}),
				channel.facts.map(_temp2$9),
				!channel.facts.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚无环境核验或采集事实；请通过宿主完成环境选择与核验。" })
			] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "项目渠道未找到，请返回列表刷新。" })]
		});
		$[0] = data.channels;
		$[1] = go;
		$[2] = id;
		$[3] = t0;
	} else t0 = $[3];
	return t0;
}
function _temp2$9(fact) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "m-0 break-all text-sm font-medium",
				children: fact.name
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-xs text-[var(--dsw-alias-label-secondary)]",
				children: ["观测时间", fact.updatedAt]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: "m-0 whitespace-pre-wrap break-all text-xs",
				children: JSON.stringify(fact.value, null, 2)
			})
		]
	}, fact.name);
}
function _temp$10(state) {
	return state.channel.selected;
}
// src/client/pages/channel/page.tsx
function Channel() {
	const $ = (0, import_dist.c)(15);
	const { data } = usePanel();
	const { openChannel, go } = useActions();
	let t0;
	let t1;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
			className: "m-0 text-base font-medium",
			children: "GitHub 环境与渠道状态"
		});
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 text-xs text-[var(--dsw-alias-label-secondary)]",
			children: "复用宿主 gh 环境。这里只显示 04 记录的核验与投递结果，不读取 token、不创建账号、不将未核验环境显示为已连接。"
		});
		$[0] = t0;
		$[1] = t1;
	} else {
		t0 = $[0];
		t1 = $[1];
	}
	let t2;
	if ($[2] !== data.channels || $[3] !== openChannel) {
		let t3;
		if ($[5] !== openChannel) {
			t3 = (channel) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "m-0 text-sm font-medium",
							children: channel.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: channel.available ? "success" : "warning",
							children: channel.available ? "最近核验可用" : "不可用"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "break-all font-mono text-xs",
						children: channel.repository ?? "仓库身份未核验"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "text-xs",
						children: channel.reason ?? "已记录 gh 环境核验，请查看具体采集时间"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						onClick: () => openChannel(channel.projectId),
						children: "查看环境与投递事实"
					})
				]
			}, channel.projectId);
			$[5] = openChannel;
			$[6] = t3;
		} else t3 = $[6];
		t2 = data.channels.map(t3);
		$[2] = data.channels;
		$[3] = openChannel;
		$[4] = t2;
	} else t2 = $[4];
	let t3;
	if ($[7] !== t2) {
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "grid gap-4 sm:grid-cols-2",
			children: t2
		});
		$[7] = t2;
		$[8] = t3;
	} else t3 = $[8];
	let t4;
	if ($[9] !== data.channels.length || $[10] !== go) {
		t4 = !data.channels.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚无项目渠道。先添加 Git 工作区并核对启用范围。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			onClick: () => go("setting"),
			children: "管理项目范围"
		})] });
		$[9] = data.channels.length;
		$[10] = go;
		$[11] = t4;
	} else t4 = $[11];
	let t5;
	if ($[12] !== t3 || $[13] !== t4) {
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex min-w-0 flex-col gap-4",
			children: [
				t0,
				t1,
				t3,
				t4
			]
		});
		$[12] = t3;
		$[13] = t4;
		$[14] = t5;
	} else t5 = $[14];
	return t5;
}
// src/client/components/source-link.tsx
function SourceLink(t0) {
	const $ = (0, import_dist.c)(7);
	const { href, children } = t0;
	let t1;
	if ($[0] !== href) {
		t1 = href && URL.canParse(href) ? new URL(href) : null;
		$[0] = href;
		$[1] = t1;
	} else t1 = $[1];
	const url = t1;
	if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
		let t2;
		if ($[2] !== children) {
			t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children });
			$[2] = children;
			$[3] = t2;
		} else t2 = $[3];
		return t2;
	}
	let t2;
	if ($[4] !== children || $[5] !== url.href) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
			href: url.href,
			target: "_blank",
			rel: "noopener noreferrer",
			className: "break-all text-[var(--dsw-alias-state-business-primary)] underline-offset-4 hover:underline focus-visible:underline",
			children: [
				children,
				" ",
				"↗"
			]
		});
		$[4] = children;
		$[5] = url.href;
		$[6] = t2;
	} else t2 = $[6];
	return t2;
}
// src/client/service/sidechat.ts
function openSidechat(ctx, sessionId) {
	const sidebar = ctx.get("betterSidebar");
	if (!sidebar) throw new Error("better-sidebar 未启用，请启用现有插件，或打开原会话");
	if (!sidebar.getTab("sidechat")) throw new Error("现有插件尚未注册 sidechat，请检查插件状态或打开原会话");
	if (!sidebar.isTabEnabled("sidechat")) throw new Error("sidechat 已在现有侧栏设置中禁用，请在那里启用或打开原会话");
	(0, react_dom.flushSync)(() => ctx.uiWorkspace.openSession(sessionId));
	sidebar.openTab({ type: "sidechat" }, { sessionId });
}
// src/client/components/source-session.tsx
function SourceSession(t0) {
	const $ = (0, import_dist.c)(51);
	const { sessionId } = t0;
	const ctx = useDshContext();
	let t1;
	if ($[0] !== sessionId) {
		t1 = () => nexus.context(sessionId);
		$[0] = sessionId;
		$[1] = t1;
	} else t1 = $[1];
	const resource = useAsyncState(t1, null);
	const [error, setError] = (0, react.useState)("");
	const [opened, setOpened] = (0, react.useState)(false);
	const [expanded, setExpanded] = (0, react.useState)(false);
	const context = resource.state;
	let t2;
	if ($[2] !== sessionId) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "m-0 break-all font-mono text-xs",
			children: ["原会话", sessionId]
		});
		$[2] = sessionId;
		$[3] = t2;
	} else t2 = $[3];
	let t3;
	if ($[4] !== resource.isLoading) {
		t3 = resource.isLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			className: "m-0 text-xs",
			children: "正在读取最近来源上下文…"
		});
		$[4] = resource.isLoading;
		$[5] = t3;
	} else t3 = $[5];
	let t4;
	if ($[6] !== resource.error) {
		t4 = !!resource.error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			role: "alert",
			className: "m-0 text-xs",
			children: [
				"读取来源上下文失败：",
				String(resource.error),
				"。已记录问题仍保留，可重试或打开原会话。"
			]
		});
		$[6] = resource.error;
		$[7] = t4;
	} else t4 = $[7];
	let t5;
	if ($[8] !== context) {
		t5 = context && !context.available && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "m-0 text-xs",
			children: [
				"来源会话不可用：",
				context.reason,
				"。已记录的问题仍可正式回答。"
			]
		});
		$[8] = context;
		$[9] = t5;
	} else t5 = $[9];
	let t6;
	if ($[10] !== context?.entries || $[11] !== expanded) {
		t6 = context?.entries.slice(expanded ? 0 : -3).map(_temp$9);
		$[10] = context?.entries;
		$[11] = expanded;
		$[12] = t6;
	} else t6 = $[12];
	let t7;
	if ($[13] !== context) {
		t7 = context?.available && !context.entries.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 text-xs",
			children: "来源会话尚无可展示的近期有效内容。"
		});
		$[13] = context;
		$[14] = t7;
	} else t7 = $[14];
	const t8 = resource.isLoading || !context?.available;
	let t9;
	if ($[15] !== ctx || $[16] !== sessionId) {
		t9 = () => {
			setError("");
			try {
				openSidechat(ctx, sessionId);
				setOpened(true);
			} catch (t10) {
				const error_0 = t10;
				setError(error_0 instanceof Error ? error_0.message : String(error_0));
			}
		};
		$[15] = ctx;
		$[16] = sessionId;
		$[17] = t9;
	} else t9 = $[17];
	let t10;
	if ($[18] !== t8 || $[19] !== t9) {
		t10 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			disabled: t8,
			onClick: t9,
			children: "打开来源侧聊"
		});
		$[18] = t8;
		$[19] = t9;
		$[20] = t10;
	} else t10 = $[20];
	let t11;
	if ($[21] !== ctx || $[22] !== sessionId) {
		t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			onClick: () => {
				try {
					ctx.uiWorkspace.openSession(sessionId);
				} catch (t12) {
					const error_1 = t12;
					setError(error_1 instanceof Error ? error_1.message : String(error_1));
				}
			},
			children: "返回原会话"
		});
		$[21] = ctx;
		$[22] = sessionId;
		$[23] = t11;
	} else t11 = $[23];
	let t12;
	if ($[24] !== resource) {
		t12 = () => void resource.executeImmediate();
		$[24] = resource;
		$[25] = t12;
	} else t12 = $[25];
	let t13;
	if ($[26] !== resource.isLoading || $[27] !== t12) {
		t13 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			disabled: resource.isLoading,
			onClick: t12,
			children: "重读来源"
		});
		$[26] = resource.isLoading;
		$[27] = t12;
		$[28] = t13;
	} else t13 = $[28];
	let t14;
	if ($[29] !== context || $[30] !== expanded) {
		t14 = context && context.entries.length > 3 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			onClick: () => setExpanded(_temp2$8),
			children: expanded ? "收起背景" : "更多近期背景"
		});
		$[29] = context;
		$[30] = expanded;
		$[31] = t14;
	} else t14 = $[31];
	let t15;
	if ($[32] !== t10 || $[33] !== t11 || $[34] !== t13 || $[35] !== t14) {
		t15 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [
				t10,
				t11,
				t13,
				t14
			]
		});
		$[32] = t10;
		$[33] = t11;
		$[34] = t13;
		$[35] = t14;
		$[36] = t15;
	} else t15 = $[36];
	let t16;
	if ($[37] !== opened) {
		t16 = opened && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			className: "m-0 text-xs",
			children: "已请求原会话的既有侧聊入口；侧聊不会结清 Nexus 问题。创建/运行结果由原侧栏显示；从 Nexus 入口返回正式答复。"
		});
		$[37] = opened;
		$[38] = t16;
	} else t16 = $[38];
	let t17;
	if ($[39] !== error) {
		t17 = error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			role: "alert",
			className: "m-0 text-xs text-[var(--dsw-alias-state-error-primary)]",
			children: [
				"来源入口失败：",
				error,
				"。请使用“返回原会话”。"
			]
		});
		$[39] = error;
		$[40] = t17;
	} else t17 = $[40];
	let t18;
	if ($[41] !== t15 || $[42] !== t16 || $[43] !== t17 || $[44] !== t2 || $[45] !== t3 || $[46] !== t4 || $[47] !== t5 || $[48] !== t6 || $[49] !== t7) {
		t18 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3",
			children: [
				t2,
				t3,
				t4,
				t5,
				t6,
				t7,
				t15,
				t16,
				t17
			]
		});
		$[41] = t15;
		$[42] = t16;
		$[43] = t17;
		$[44] = t2;
		$[45] = t3;
		$[46] = t4;
		$[47] = t5;
		$[48] = t6;
		$[49] = t7;
		$[50] = t18;
	} else t18 = $[50];
	return t18;
}
function _temp2$8(value) {
	return !value;
}
function _temp$9(entry, index) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("blockquote", {
		className: "m-0 border-l border-[var(--dsw-alias-border-l2)] pl-3 text-xs",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "m-0 text-[var(--dsw-alias-label-tertiary)]",
			children: [
				entry.origin,
				" ",
				"·",
				" ",
				entry.at
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mb-0 mt-1 whitespace-pre-wrap break-words",
			children: entry.text
		})]
	}, entry.at + index);
}
// src/client/components/ask-card.tsx
function AskCard({ ask: initial, onSettled }) {
	const { refresh } = usePanel();
	const { openTicket } = useActions();
	const read = useStore((state) => state.read.state);
	const [receipt, setReceipt] = (0, react.useState)(null);
	const ask = receipt ?? initial;
	const [answer, setAnswer] = (0, react.useState)("");
	const [selections, setSelections] = (0, react.useState)([]);
	const [submitting, setSubmitting] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	const lock = (0, react.useRef)(false);
	const form = (0, react.useRef)(null);
	async function submit() {
		if (lock.current) return;
		lock.current = true;
		setSubmitting(true);
		setError("");
		try {
			const result = await nexus.answer({
				askId: ask.id,
				policyBasis: ask.policyBasis,
				target: ask.target ?? void 0,
				answer: answer.trim() || selections.join(", "),
				selections: ask.presentation.multiSelect ? selections : void 0
			});
			setReceipt(result.ask);
			await refresh();
			onSettled?.();
		} catch (error_0) {
			setError(`未能确认正式答复结果：${error_0 instanceof Error ? error_0.message : String(error_0)}。输入已保留，请刷新核对当前问题后重试。`);
			await refresh();
			form.current?.querySelector("input, textarea, button")?.focus();
		} finally {
			lock.current = false;
			setSubmitting(false);
		}
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4",
		"aria-label": ask.presentation.title ?? ask.content,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: ask.status === "pending" ? "warning" : ask.status === "answered" ? "success" : "quiet",
						children: ask.status === "pending" ? ask.actionable ? "等本人答复" : "提醒本人处置" : ask.status === "answered" ? "已正式回答" : "已撤销"
					}),
					ask.humanRequired && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: "warning",
						children: "必须本人决定"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "text-xs text-[var(--dsw-alias-label-secondary)]",
						children: [
							ask.waiting?.role ?? ask.initiatorRole,
							" ",
							"等待 ·",
							" ",
							Math.floor(ask.waitingMilliseconds / 6e4),
							" ",
							"分钟 ·",
							" ",
							ask.decisionType
						]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "m-0 break-words text-sm font-medium",
				children: ask.presentation.title ?? ask.content
			}),
			ask.presentation.title && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 whitespace-pre-wrap break-words",
				children: ask.content
			}),
			ask.presentation.detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 whitespace-pre-wrap text-xs text-[var(--dsw-alias-label-secondary)]",
				children: ask.presentation.detail
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [ask.ticketIds.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					variant: "ghost",
					onClick: () => openTicket(id),
					children: id
				}, id)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "break-all text-xs text-[var(--dsw-alias-label-tertiary)]",
					children: [
						"来源：",
						ask.source,
						" ",
						"·",
						ask.createdAt
					]
				})]
			}),
			ask.target && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceLink, {
						href: ask.target.pullRequest,
						children: ask.target.pullRequest
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "mb-0 break-all font-mono",
						children: [
							ask.target.repository,
							" ",
							"· base",
							" ",
							ask.target.base,
							" ",
							"· head",
							" ",
							ask.target.head
						]
					}),
					ask.evidence.map((evidence) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "mb-0",
						children: [
							"验收",
							evidence.verdict,
							" ",
							"·",
							evidence.scope,
							" ",
							"·",
							evidence.basis,
							" ",
							"·",
							evidence.evidence,
							" ",
							"·",
							evidence.createdAt
						]
					}, evidence.id))
				]
			}),
			ask.reminders.map((reminder) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "m-0 text-xs text-[var(--dsw-alias-state-warn-primary)]",
				children: [
					reminder.due ? "提醒已到期" : `等待截止 ${reminder.dueAt}`,
					" ",
					"·",
					" ",
					reminder.remindedAt ? `已提醒 ${reminder.remindedAt}` : "尚未提醒",
					" ",
					"·",
					" ",
					reminder.deliveryState,
					reminder.deliveryError && `：${reminder.deliveryError}`
				]
			}, reminder.id)),
			ask.waiting ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceSession, { sessionId: ask.waiting.sessionId }, ask.waiting.sessionId) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-xs",
				children: "来源会话尚未恢复；已记录问题仍可正式回答。请按来源记录查找原会话。"
			}),
			ask.status === "pending" && ask.actionable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				ref: form,
				onSubmit: (event) => {
					event.preventDefault();
					submit();
				},
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						disabled: submitting || read !== "ready",
						className: "m-0 flex flex-col gap-2 border-0 p-0",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
								className: "mb-2 text-xs",
								children: ["请选择选项或填写正式答复", ask.presentation.multiSelect ? "（可多选）" : ""]
							}),
							ask.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "flex cursor-pointer items-center gap-2 py-1",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: ask.presentation.multiSelect ? "checkbox" : "radio",
									name: ask.id,
									value: option,
									checked: ask.presentation.multiSelect ? selections.includes(option) : answer === option,
									onChange: (event_0) => ask.presentation.multiSelect ? setSelections((previous) => event_0.target.checked ? [...previous, option] : previous.filter((value) => value !== option)) : setAnswer(option)
								}), option]
							}, option)),
							!["merge", "delivery"].includes(ask.decisionType) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1",
								children: ["正式答复", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									value: answer,
									onChange: (event_1) => setAnswer(event_1.target.value),
									rows: 2,
									className: "w-full rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2 text-[var(--dsw-alias-label-primary)]"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								type: "submit",
								size: "sm",
								variant: "outline",
								disabled: !answer.trim() && !selections.length || !!ask.presentation.multiSelect && !selections.length,
								children: submitting ? "正在提交正式答复…" : "提交正式答复"
							})
						]
					}),
					read !== "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: "m-0 text-xs",
						children: "正在核对或读取失败，暂不接受新的答复；请刷新后重试。"
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "m-0 text-xs text-[var(--dsw-alias-state-error-primary)]",
						children: error
					})
				]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "m-0 whitespace-pre-wrap break-words",
				children: ask.status === "answered" ? `生效答案：${ask.answer} · 实际来源：${ask.answerSource} · ${ask.answeredAt}` : ask.status === "pending" ? `当前处理责任：${ask.handler}，提醒需要协调，不重复创建答复卡。` : `不可再答复：${ask.cancelReason}`
			}),
			ask.deliveries.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "m-0 text-xs text-[var(--dsw-alias-label-secondary)]",
				children: [
					message.kind === "answer" ? "正式答案回送" : "问题投递",
					"：",
					message.state,
					" ",
					"·",
					" ",
					message.recipient,
					message.error && ` · ${message.error}`
				]
			}, message.id)),
			ask.publications.map((publication) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "m-0 text-xs",
				children: [
					publication.syncProblem || publication.state === "failed" || publication.state === "unknown" ? "GitHub 同步问题（无需重答）" : "GitHub 投递",
					"：",
					publication.state,
					" ",
					"·",
					" ",
					publication.syncProblem ?? publication.error,
					publication.syncAt,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceLink, {
						href: publication.remoteUrl,
						children: publication.remoteId
					})
				]
			}, publication.id))
		]
	});
}
// src/client/pages/ticket/page.tsx
function Filters() {
	const $ = (0, import_dist.c)(24);
	const { data } = usePanel();
	const filters = useStore(_temp$8);
	const { filter } = useActions();
	const t0 = filters.project;
	let t1;
	if ($[0] !== filter) {
		t1 = (event) => filter({ project: event.target.value });
		$[0] = filter;
		$[1] = t1;
	} else t1 = $[1];
	let t2;
	if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "",
			children: "全部项目"
		});
		$[2] = t2;
	} else t2 = $[2];
	let t3;
	if ($[3] !== data.projects) {
		t3 = data.projects.map(_temp2$7);
		$[3] = data.projects;
		$[4] = t3;
	} else t3 = $[4];
	let t4;
	if ($[5] !== filters.project || $[6] !== t1 || $[7] !== t3) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["项目", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
			className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1",
			value: t0,
			onChange: t1,
			children: [t2, t3]
		})] });
		$[5] = filters.project;
		$[6] = t1;
		$[7] = t3;
		$[8] = t4;
	} else t4 = $[8];
	const t5 = filters.status;
	let t6;
	if ($[9] !== filter) {
		t6 = (event_0) => filter({ status: event_0.target.value });
		$[9] = filter;
		$[10] = t6;
	} else t6 = $[10];
	let t7;
	let t8;
	if ($[11] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "",
			children: "全部状态"
		});
		t8 = [
			"waiting",
			"queued",
			"running",
			"review",
			"done",
			"cancelled",
			"paused",
			"error"
		].map(_temp3$4);
		$[11] = t7;
		$[12] = t8;
	} else {
		t7 = $[11];
		t8 = $[12];
	}
	let t9;
	if ($[13] !== filters.status || $[14] !== t6) {
		t9 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["状态", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
			className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1",
			value: t5,
			onChange: t6,
			children: [t7, t8]
		})] });
		$[13] = filters.status;
		$[14] = t6;
		$[15] = t9;
	} else t9 = $[15];
	let t10;
	if ($[16] !== filter || $[17] !== filters.project || $[18] !== filters.status) {
		t10 = (filters.project || filters.status) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			variant: "ghost",
			size: "sm",
			onClick: () => filter({
				project: "",
				status: ""
			}),
			children: "清除筛选"
		});
		$[16] = filter;
		$[17] = filters.project;
		$[18] = filters.status;
		$[19] = t10;
	} else t10 = $[19];
	let t11;
	if ($[20] !== t10 || $[21] !== t4 || $[22] !== t9) {
		t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-3",
			children: [
				t4,
				t9,
				t10
			]
		});
		$[20] = t10;
		$[21] = t4;
		$[22] = t9;
		$[23] = t11;
	} else t11 = $[23];
	return t11;
}
function _temp3$4(value) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
		value,
		children: value
	}, value);
}
function _temp2$7(project) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
		value: project.id,
		children: project.name
	}, project.id);
}
function _temp$8(state) {
	return state.filters;
}
function TicketRows() {
	const $ = (0, import_dist.c)(20);
	const { data } = usePanel();
	const { openTicket, go } = useActions();
	const filters = useStore(_temp4$3);
	const t0 = data.tickets;
	let t1;
	let t2;
	let t3;
	if ($[0] !== data.projects || $[1] !== data.tickets || $[2] !== filters || $[3] !== go || $[4] !== openTicket) {
		t3 = Symbol.for("react.early_return_sentinel");
		bb0: {
			let t4;
			if ($[8] !== filters) {
				t4 = (t5) => {
					const { ticket } = t5;
					return (!filters.project || ticket.projectId === filters.project) && (!filters.status || (filters.status === "paused" ? ticket.paused : filters.status === "error" ? ticket.failureReason : ticket.status === filters.status));
				};
				$[8] = filters;
				$[9] = t4;
			} else t4 = $[9];
			const tickets = t0.filter(t4);
			if (!data.tickets.length) {
				let t5;
				if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
					t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "账本中尚无工单。启用可用 Git 项目后，由 main 根据来源目标分诊。" });
					$[10] = t5;
				} else t5 = $[10];
				let t6;
				if ($[11] !== go) {
					t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [t5, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						onClick: () => go("setting"),
						children: "检查项目范围"
					})] });
					$[11] = go;
					$[12] = t6;
				} else t6 = $[12];
				t3 = t6;
				break bb0;
			}
			if (!tickets.length) {
				let t5;
				if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
					t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: "没有匹配的工单。请清除项目或状态筛选。"
					});
					$[13] = t5;
				} else t5 = $[13];
				t3 = t5;
				break bb0;
			}
			t1 = "m-0 list-none rounded-xl border border-[var(--dsw-alias-border-l3)] p-0";
			let t5;
			if ($[14] !== data.projects || $[15] !== openTicket) {
				t5 = (t6) => {
					const { ticket: ticket_0, reasons } = t6;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center gap-3 border-b border-[var(--dsw-alias-border-l3)] px-4 py-3 last:border-0",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								onClick: () => openTicket(ticket_0.id),
								children: ticket_0.title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs",
								children: ticket_0.id
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: ticket_0.paused || ticket_0.failureReason ? "warning" : ticket_0.status === "done" ? "success" : "quiet",
								children: ticket_0.paused ? "paused" : ticket_0.status
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "text-xs text-[var(--dsw-alias-label-secondary)]",
								children: [
									data.projects.find((project) => project.id === ticket_0.projectId)?.name,
									" ",
									"·",
									" ",
									reasons.join(" · ") || "无阻塞"
								]
							})
						]
					}, ticket_0.id);
				};
				$[14] = data.projects;
				$[15] = openTicket;
				$[16] = t5;
			} else t5 = $[16];
			t2 = tickets.map(t5);
		}
		$[0] = data.projects;
		$[1] = data.tickets;
		$[2] = filters;
		$[3] = go;
		$[4] = openTicket;
		$[5] = t1;
		$[6] = t2;
		$[7] = t3;
	} else {
		t1 = $[5];
		t2 = $[6];
		t3 = $[7];
	}
	if (t3 !== Symbol.for("react.early_return_sentinel")) return t3;
	let t4;
	if ($[17] !== t1 || $[18] !== t2) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
			className: t1,
			children: t2
		});
		$[17] = t1;
		$[18] = t2;
		$[19] = t4;
	} else t4 = $[19];
	return t4;
}
function _temp4$3(state) {
	return state.filters;
}
function Ticket() {
	const $ = (0, import_dist.c)(7);
	const { data } = usePanel();
	let t0;
	if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
		t0 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
			className: "m-0 text-base font-medium",
			children: "工单目标与进展"
		});
		$[0] = t0;
	} else t0 = $[0];
	let t1;
	if ($[1] !== data.inbox.pending) {
		t1 = data.inbox.pending.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex flex-col gap-3",
			"aria-label": "待本人决定",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "m-0 text-sm font-medium",
				children: "待本人决定"
			}), data.inbox.pending.map(_temp5$3)]
		});
		$[1] = data.inbox.pending;
		$[2] = t1;
	} else t1 = $[2];
	let t2;
	let t3;
	if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Filters, {});
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TicketRows, {});
		$[3] = t2;
		$[4] = t3;
	} else {
		t2 = $[3];
		t3 = $[4];
	}
	let t4;
	if ($[5] !== t1) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex flex-col gap-4",
			children: [
				t0,
				t1,
				t2,
				t3
			]
		});
		$[5] = t1;
		$[6] = t4;
	} else t4 = $[6];
	return t4;
}
function _temp5$3(ask) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AskCard, { ask }, ask.id);
}
// src/client/pages/overview/components/graph-layout.ts
const AGENT_GRAPH = {
	nodeWidth: 168,
	nodeHeight: 68,
	width: 1100,
	height: 400,
	zoomMin: .5,
	zoomMax: 2
};
const AGENT_GRAPH_EDGE_COLORS = {
	flow: "var(--dsw-alias-label-tertiary)",
	dispatch: "var(--dsw-alias-state-warn-primary)",
	association: "var(--dsw-alias-state-business-primary)",
	dependency: "var(--dsw-alias-state-warn-primary)"
};
// src/client/pages/overview/components/graph-edge-path.tsx
function GraphEdgePath(t0) {
	const $ = (0, import_dist.c)(33);
	const { edge, nodes, selectedId } = t0;
	const { t } = useTranslation();
	let t1;
	if ($[0] !== edge || $[1] !== nodes) {
		let t2;
		if ($[3] !== edge) {
			t2 = (node) => node.id === edge.source;
			$[3] = edge;
			$[4] = t2;
		} else t2 = $[4];
		t1 = nodes.find(t2);
		$[0] = edge;
		$[1] = nodes;
		$[2] = t1;
	} else t1 = $[2];
	const source = t1;
	let t2;
	if ($[5] !== edge || $[6] !== nodes) {
		let t3;
		if ($[8] !== edge) {
			t3 = (node_0) => node_0.id === edge.target;
			$[8] = edge;
			$[9] = t3;
		} else t3 = $[9];
		t2 = nodes.find(t3);
		$[5] = edge;
		$[6] = nodes;
		$[7] = t2;
	} else t2 = $[7];
	const target = t2;
	if (!source || !target) return null;
	const vertical = source.x === target.x;
	const sx = source.x + (vertical ? AGENT_GRAPH.nodeWidth / 2 : AGENT_GRAPH.nodeWidth + 6);
	const sy = source.y + (vertical ? AGENT_GRAPH.nodeHeight + 6 : AGENT_GRAPH.nodeHeight / 2);
	const tx = target.x + (vertical ? AGENT_GRAPH.nodeWidth / 2 : -6);
	const ty = target.y + (vertical ? -6 : AGENT_GRAPH.nodeHeight / 2);
	const middle = (sx + tx) / 2;
	const related = !selectedId || edge.source === selectedId || edge.target === selectedId;
	const tone = edge.kind === "flow" && source.kind === "route" ? "dispatch" : edge.kind;
	const color = AGENT_GRAPH_EDGE_COLORS[tone];
	let t3;
	if ($[10] !== edge.kind || $[11] !== t) {
		t3 = edge.kind === "association" ? t("graphAssociation") : edge.kind === "dependency" ? t("graphDependency") : null;
		$[10] = edge.kind;
		$[11] = t;
		$[12] = t3;
	} else t3 = $[12];
	const label = t3;
	const path = vertical ? `M ${sx} ${sy} L ${tx} ${ty}` : `M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx - 16} ${ty} H ${tx}`;
	const arrow = vertical ? `M ${tx - 4} ${ty - 7} L ${tx} ${ty} L ${tx + 4} ${ty - 7}` : `M ${tx - 7} ${ty - 4} L ${tx} ${ty} L ${tx - 7} ${ty + 4}`;
	const t4 = related ? 1 : .25;
	const t5 = related && selectedId ? 1.8 : 1.4;
	const t6 = edge.kind === "association" ? "5 4" : void 0;
	let t7;
	if ($[13] !== path || $[14] !== t6) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: path,
			strokeDasharray: t6
		});
		$[13] = path;
		$[14] = t6;
		$[15] = t7;
	} else t7 = $[15];
	let t8;
	if ($[16] !== arrow || $[17] !== edge.kind) {
		t8 = edge.kind !== "association" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: arrow });
		$[16] = arrow;
		$[17] = edge.kind;
		$[18] = t8;
	} else t8 = $[18];
	let t9;
	if ($[19] !== color || $[20] !== edge.kind || $[21] !== label || $[22] !== sx || $[23] !== sy || $[24] !== ty) {
		t9 = label && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
			x: edge.kind === "dependency" ? sx - 10 : sx + 10,
			y: (sy + ty) / 2 + 4,
			fill: color,
			fontSize: 12,
			textAnchor: edge.kind === "dependency" ? "end" : "start",
			paintOrder: "stroke",
			stroke: "var(--dsw-alias-bg-layer-1)",
			strokeWidth: 6,
			strokeLinejoin: "round",
			children: label
		});
		$[19] = color;
		$[20] = edge.kind;
		$[21] = label;
		$[22] = sx;
		$[23] = sy;
		$[24] = ty;
		$[25] = t9;
	} else t9 = $[25];
	let t10;
	if ($[26] !== color || $[27] !== t4 || $[28] !== t5 || $[29] !== t7 || $[30] !== t8 || $[31] !== t9) {
		t10 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
			opacity: t4,
			pointerEvents: "none",
			fill: "none",
			stroke: color,
			strokeWidth: t5,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			children: [
				t7,
				t8,
				t9
			]
		});
		$[26] = color;
		$[27] = t4;
		$[28] = t5;
		$[29] = t7;
		$[30] = t8;
		$[31] = t9;
		$[32] = t10;
	} else t10 = $[32];
	return t10;
}
// src/client/pages/overview/components/graph-node-card.tsx
function GraphNodeCard(t0) {
	const $ = (0, import_dist.c)(19);
	const { node, selected, onSelect } = t0;
	const Icon = node.kind === "channel" ? ChannelsIcon : node.kind === "task" ? TasksIcon : node.kind === "session" ? AgentIcon : NexusIcon;
	const t1 = `${node.label} ${node.status}`;
	const t2 = selected ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-border-l2)";
	let t3;
	if ($[0] !== t2) {
		t3 = { borderColor: t2 };
		$[0] = t2;
		$[1] = t3;
	} else t3 = $[1];
	let t4;
	if ($[2] !== Icon) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
			width: 18,
			height: 18,
			className: "shrink-0 text-[var(--dsw-alias-label-secondary)]"
		});
		$[2] = Icon;
		$[3] = t4;
	} else t4 = $[3];
	let t5;
	if ($[4] !== node.label) {
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "block truncate text-[13px] font-medium",
			children: node.label
		});
		$[4] = node.label;
		$[5] = t5;
	} else t5 = $[5];
	let t6;
	if ($[6] !== node.status || $[7] !== node.subtitle) {
		t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "block truncate text-[11px] text-[var(--dsw-alias-label-tertiary)]",
			children: [
				node.status,
				" ",
				"·",
				" ",
				node.subtitle
			]
		});
		$[6] = node.status;
		$[7] = node.subtitle;
		$[8] = t6;
	} else t6 = $[8];
	let t7;
	if ($[9] !== t5 || $[10] !== t6) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "min-w-0 flex-1",
			children: [t5, t6]
		});
		$[9] = t5;
		$[10] = t6;
		$[11] = t7;
	} else t7 = $[11];
	let t8;
	if ($[12] !== onSelect || $[13] !== selected || $[14] !== t1 || $[15] !== t3 || $[16] !== t4 || $[17] !== t7) {
		t8 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			"aria-pressed": selected,
			"aria-label": t1,
			onClick: onSelect,
			className: "flex h-full w-full items-center gap-3 rounded-xl border bg-[var(--dsw-alias-bg-layer-1)] px-3 text-left font-[inherit] outline-none focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--dsw-alias-state-business-primary)]",
			style: t3,
			children: [t4, t7]
		});
		$[12] = onSelect;
		$[13] = selected;
		$[14] = t1;
		$[15] = t3;
		$[16] = t4;
		$[17] = t7;
		$[18] = t8;
	} else t8 = $[18];
	return t8;
}
// src/client/pages/overview/components/graph-canvas.tsx
function GraphCanvas(t0) {
	const $ = (0, import_dist.c)(108);
	const { nodes, edges } = t0;
	const { t } = useTranslation();
	const { zoomGraph, panGraph, resetGraph, selectAgent, openTicket } = useActions();
	const { zoom, x, y, selectedId } = useStore(_temp$7);
	const drag = (0, react.useRef)(null);
	let t1;
	if ($[0] !== nodes) {
		t1 = Math.max(AGENT_GRAPH.width, ...nodes.map(_temp2$6));
		$[0] = nodes;
		$[1] = t1;
	} else t1 = $[1];
	const canvasWidth = t1;
	let t2;
	if ($[2] !== nodes) {
		t2 = Math.max(AGENT_GRAPH.height, ...nodes.map(_temp3$3));
		$[2] = nodes;
		$[3] = t2;
	} else t2 = $[3];
	const canvasHeight = t2;
	const width = canvasWidth / zoom;
	const height = canvasHeight / zoom;
	const left = (canvasWidth - width) / 2 + x;
	const top = (canvasHeight - height) / 2 + y;
	let t3;
	if ($[4] !== nodes || $[5] !== selectedId) {
		let t4;
		if ($[7] !== selectedId) {
			t4 = (node_1) => node_1.id === selectedId;
			$[7] = selectedId;
			$[8] = t4;
		} else t4 = $[8];
		t3 = nodes.find(t4);
		$[4] = nodes;
		$[5] = selectedId;
		$[6] = t3;
	} else t3 = $[6];
	const selected = t3;
	let t4;
	if ($[9] !== nodes) {
		const supervised = nodes.filter(_temp4$2);
		t4 = supervised.length ? {
			x: Math.min(...supervised.map(_temp5$2)) - 16,
			y: Math.min(...supervised.map(_temp6$1)) - 12,
			width: Math.max(...supervised.map(_temp7$1)) - Math.min(...supervised.map(_temp8$1)) + AGENT_GRAPH.nodeWidth + 32,
			height: Math.max(...supervised.map(_temp9$1)) - Math.min(...supervised.map(_temp0$1)) + AGENT_GRAPH.nodeHeight + 28
		} : null;
		$[9] = nodes;
		$[10] = t4;
	} else t4 = $[10];
	const group = t4;
	const t5 = `${left} ${top} ${width} ${height}`;
	let t6;
	if ($[11] !== t) {
		t6 = t("graphTitle");
		$[11] = t;
		$[12] = t6;
	} else t6 = $[12];
	let t7;
	if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = (event) => {
			if (event.button !== 0 || event.target.closest("button")) return;
			drag.current = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		};
		$[13] = t7;
	} else t7 = $[13];
	let t8;
	if ($[14] !== height || $[15] !== panGraph || $[16] !== width) {
		t8 = (event_0) => {
			const previous = drag.current;
			if (!previous || previous.id !== event_0.pointerId) return;
			const bounds = event_0.currentTarget.getBoundingClientRect();
			const scale = Math.min(bounds.width / width, bounds.height / height);
			if (scale > 0) panGraph((previous.x - event_0.clientX) / scale, (previous.y - event_0.clientY) / scale);
			drag.current = {
				id: event_0.pointerId,
				x: event_0.clientX,
				y: event_0.clientY
			};
		};
		$[14] = height;
		$[15] = panGraph;
		$[16] = width;
		$[17] = t8;
	} else t8 = $[17];
	let t10;
	let t11;
	let t9;
	if ($[18] === Symbol.for("react.memo_cache_sentinel")) {
		t9 = (event_1) => {
			drag.current = null;
			if (event_1.currentTarget.hasPointerCapture(event_1.pointerId)) event_1.currentTarget.releasePointerCapture(event_1.pointerId);
		};
		t10 = () => {
			drag.current = null;
		};
		t11 = () => {
			drag.current = null;
		};
		$[18] = t10;
		$[19] = t11;
		$[20] = t9;
	} else {
		t10 = $[18];
		t11 = $[19];
		t9 = $[20];
	}
	let t12;
	if ($[21] !== panGraph || $[22] !== resetGraph || $[23] !== zoom || $[24] !== zoomGraph) {
		t12 = (event_2) => {
			if (event_2.target !== event_2.currentTarget) return;
			const delta = 40 / zoom;
			if (event_2.key === "ArrowLeft") panGraph(-delta, 0);
			else if (event_2.key === "ArrowRight") panGraph(delta, 0);
			else if (event_2.key === "ArrowUp") panGraph(0, -delta);
			else if (event_2.key === "ArrowDown") panGraph(0, delta);
			else if (event_2.key === "+" || event_2.key === "=") zoomGraph(.2);
			else if (event_2.key === "-") zoomGraph(-.2);
			else if (event_2.key === "Home") resetGraph();
			else return;
			event_2.preventDefault();
		};
		$[21] = panGraph;
		$[22] = resetGraph;
		$[23] = zoom;
		$[24] = zoomGraph;
		$[25] = t12;
	} else t12 = $[25];
	let t13;
	if ($[26] !== group || $[27] !== t) {
		t13 = group && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
			pointerEvents: "none",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: group.x,
				y: group.y,
				width: group.width,
				height: group.height,
				rx: 18,
				fill: "var(--dsw-alias-state-business-primary)",
				fillOpacity: .025,
				stroke: "var(--dsw-alias-state-business-primary)",
				strokeOpacity: .5,
				strokeDasharray: "6 5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
				x: group.x + 12,
				y: group.y - 10,
				fill: "var(--dsw-alias-state-business-primary)",
				fontSize: 13,
				children: t("graphSupervisor")
			})]
		});
		$[26] = group;
		$[27] = t;
		$[28] = t13;
	} else t13 = $[28];
	let t14;
	if ($[29] !== edges || $[30] !== nodes || $[31] !== selectedId) {
		let t15;
		if ($[33] !== nodes || $[34] !== selectedId) {
			t15 = (edge) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GraphEdgePath, {
				edge,
				nodes,
				selectedId
			}, `${edge.source}-${edge.target}-${edge.kind}`);
			$[33] = nodes;
			$[34] = selectedId;
			$[35] = t15;
		} else t15 = $[35];
		t14 = edges.map(t15);
		$[29] = edges;
		$[30] = nodes;
		$[31] = selectedId;
		$[32] = t14;
	} else t14 = $[32];
	let t15;
	if ($[36] !== nodes || $[37] !== selectAgent || $[38] !== selectedId) {
		let t16;
		if ($[40] !== selectAgent || $[41] !== selectedId) {
			t16 = (node_9) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("foreignObject", {
				x: node_9.x,
				y: node_9.y,
				width: AGENT_GRAPH.nodeWidth,
				height: AGENT_GRAPH.nodeHeight,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GraphNodeCard, {
					node: node_9,
					selected: selectedId === node_9.id,
					onSelect: () => selectAgent(node_9.id)
				})
			}, node_9.id);
			$[40] = selectAgent;
			$[41] = selectedId;
			$[42] = t16;
		} else t16 = $[42];
		t15 = nodes.map(t16);
		$[36] = nodes;
		$[37] = selectAgent;
		$[38] = selectedId;
		$[39] = t15;
	} else t15 = $[39];
	let t16;
	if ($[43] !== t12 || $[44] !== t13 || $[45] !== t14 || $[46] !== t15 || $[47] !== t5 || $[48] !== t6 || $[49] !== t8) {
		t16 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "overflow-x-auto",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: t5,
				className: "block h-[380px] w-full min-w-[1040px] touch-none select-none bg-[var(--dsw-alias-bg-layer-2)]/40 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dsw-alias-state-business-primary)]",
				"aria-label": t6,
				role: "group",
				tabIndex: 0,
				onPointerDown: t7,
				onPointerMove: t8,
				onPointerUp: t9,
				onPointerCancel: t10,
				onLostPointerCapture: t11,
				onKeyDown: t12,
				children: [
					t13,
					t14,
					t15
				]
			})
		});
		$[43] = t12;
		$[44] = t13;
		$[45] = t14;
		$[46] = t15;
		$[47] = t5;
		$[48] = t6;
		$[49] = t8;
		$[50] = t16;
	} else t16 = $[50];
	let t17;
	if ($[51] !== t) {
		t17 = t("graphZoomOut");
		$[51] = t;
		$[52] = t17;
	} else t17 = $[52];
	const t18 = zoom <= AGENT_GRAPH.zoomMin;
	let t19;
	if ($[53] !== zoomGraph) {
		t19 = () => zoomGraph(-.2);
		$[53] = zoomGraph;
		$[54] = t19;
	} else t19 = $[54];
	let t20;
	if ($[55] === Symbol.for("react.memo_cache_sentinel")) {
		t20 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ZoomOutIcon, {
			width: 16,
			height: 16
		});
		$[55] = t20;
	} else t20 = $[55];
	let t21;
	if ($[56] !== t17 || $[57] !== t18 || $[58] !== t19) {
		t21 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			"aria-label": t17,
			disabled: t18,
			onClick: t19,
			icon: t20
		});
		$[56] = t17;
		$[57] = t18;
		$[58] = t19;
		$[59] = t21;
	} else t21 = $[59];
	let t22;
	if ($[60] !== zoom) {
		t22 = Math.round(zoom * 100);
		$[60] = zoom;
		$[61] = t22;
	} else t22 = $[61];
	const t23 = `${t22}%`;
	let t24;
	if ($[62] !== t23) {
		t24 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "min-w-10 text-center text-xs tabular-nums text-[var(--dsw-alias-label-secondary)]",
			children: t23
		});
		$[62] = t23;
		$[63] = t24;
	} else t24 = $[63];
	let t25;
	if ($[64] !== t) {
		t25 = t("graphZoomIn");
		$[64] = t;
		$[65] = t25;
	} else t25 = $[65];
	const t26 = zoom >= AGENT_GRAPH.zoomMax;
	let t27;
	if ($[66] !== zoomGraph) {
		t27 = () => zoomGraph(.2);
		$[66] = zoomGraph;
		$[67] = t27;
	} else t27 = $[67];
	let t28;
	if ($[68] === Symbol.for("react.memo_cache_sentinel")) {
		t28 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ZoomInIcon, {
			width: 16,
			height: 16
		});
		$[68] = t28;
	} else t28 = $[68];
	let t29;
	if ($[69] !== t25 || $[70] !== t26 || $[71] !== t27) {
		t29 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			"aria-label": t25,
			disabled: t26,
			onClick: t27,
			icon: t28
		});
		$[69] = t25;
		$[70] = t26;
		$[71] = t27;
		$[72] = t29;
	} else t29 = $[72];
	let t30;
	if ($[73] !== t) {
		t30 = t("graphFit");
		$[73] = t;
		$[74] = t30;
	} else t30 = $[74];
	let t31;
	if ($[75] === Symbol.for("react.memo_cache_sentinel")) {
		t31 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FitViewIcon, {
			width: 16,
			height: 16
		});
		$[75] = t31;
	} else t31 = $[75];
	let t32;
	if ($[76] !== resetGraph || $[77] !== t30) {
		t32 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			"aria-label": t30,
			onClick: resetGraph,
			icon: t31
		});
		$[76] = resetGraph;
		$[77] = t30;
		$[78] = t32;
	} else t32 = $[78];
	let t33;
	if ($[79] !== t21 || $[80] !== t24 || $[81] !== t29 || $[82] !== t32) {
		t33 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "absolute right-3 bottom-3 flex items-center gap-1 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-1 shadow-sm",
			children: [
				t21,
				t24,
				t29,
				t32
			]
		});
		$[79] = t21;
		$[80] = t24;
		$[81] = t29;
		$[82] = t32;
		$[83] = t33;
	} else t33 = $[83];
	let t34;
	if ($[84] !== t16 || $[85] !== t33) {
		t34 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "relative",
			children: [t16, t33]
		});
		$[84] = t16;
		$[85] = t33;
		$[86] = t34;
	} else t34 = $[86];
	let t35;
	if ($[87] !== t) {
		t35 = t("graphHint");
		$[87] = t;
		$[88] = t35;
	} else t35 = $[88];
	let t36;
	if ($[89] !== t35) {
		t36 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t35 });
		$[89] = t35;
		$[90] = t36;
	} else t36 = $[90];
	let t37;
	if ($[91] === Symbol.for("react.memo_cache_sentinel")) {
		t37 = [
			"flow",
			"association",
			"dependency"
		];
		$[91] = t37;
	} else t37 = $[91];
	let t38;
	if ($[92] !== t) {
		t38 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "ml-auto flex gap-3",
			children: t37.map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "h-px w-4",
					style: { background: AGENT_GRAPH_EDGE_COLORS[kind] }
				}), t(kind === "flow" ? "graphFlow" : kind === "association" ? "graphAssociation" : "graphDependency")]
			}, kind))
		});
		$[92] = t;
		$[93] = t38;
	} else t38 = $[93];
	let t39;
	if ($[94] !== t36 || $[95] !== t38) {
		t39 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--dsw-alias-border-l3)] px-5 py-3 text-[11px] text-[var(--dsw-alias-label-tertiary)]",
			children: [t36, t38]
		});
		$[94] = t36;
		$[95] = t38;
		$[96] = t39;
	} else t39 = $[96];
	let t40;
	if ($[97] !== selected) {
		t40 = selected?.sessionId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceSession, { sessionId: selected.sessionId }, selected.sessionId);
		$[97] = selected;
		$[98] = t40;
	} else t40 = $[98];
	let t41;
	if ($[99] !== openTicket || $[100] !== selected || $[101] !== t) {
		t41 = selected && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3 border-t border-[var(--dsw-alias-border-l3)] px-5 py-3 text-xs",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgentIcon, {
					width: 16,
					height: 16
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [selected.label, selected.subtitle ? ` · ${selected.subtitle}` : ""] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "text-[var(--dsw-alias-label-tertiary)]",
					children: selected.status
				}),
				selected.taskId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					variant: "outline",
					onClick: () => {
						if (selected.taskId) openTicket(selected.taskId);
					},
					className: "ml-auto",
					children: t("overviewOpenDetails")
				})
			]
		});
		$[99] = openTicket;
		$[100] = selected;
		$[101] = t;
		$[102] = t41;
	} else t41 = $[102];
	let t42;
	if ($[103] !== t34 || $[104] !== t39 || $[105] !== t40 || $[106] !== t41) {
		t42 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
			t34,
			t39,
			t40,
			t41
		] });
		$[103] = t34;
		$[104] = t39;
		$[105] = t40;
		$[106] = t41;
		$[107] = t42;
	} else t42 = $[107];
	return t42;
}
function _temp0$1(node_8) {
	return node_8.y;
}
function _temp9$1(node_7) {
	return node_7.y;
}
function _temp8$1(node_6) {
	return node_6.x;
}
function _temp7$1(node_5) {
	return node_5.x;
}
function _temp6$1(node_4) {
	return node_4.y;
}
function _temp5$2(node_3) {
	return node_3.x;
}
function _temp4$2(node_2) {
	return node_2.group === "supervisor";
}
function _temp3$3(node_0) {
	return node_0.y + AGENT_GRAPH.nodeHeight + 20;
}
function _temp2$6(node) {
	return node.x + AGENT_GRAPH.nodeWidth + 20;
}
function _temp$7(state) {
	return state.graph;
}
// src/client/pages/overview/components/graph.tsx
function Graph() {
	const $ = (0, import_dist.c)(16);
	const { data } = usePanel();
	const filters = useStore(_temp$6);
	let t0;
	if ($[0] !== data.tickets || $[1] !== filters) {
		let t1;
		if ($[3] !== filters) {
			t1 = (t2) => {
				const { ticket } = t2;
				return (!filters.project || ticket.projectId === filters.project) && (!filters.status || (filters.status === "paused" ? ticket.paused : filters.status === "error" ? ticket.failureReason : ticket.status === filters.status));
			};
			$[3] = filters;
			$[4] = t1;
		} else t1 = $[4];
		t0 = new Set(data.tickets.filter(t1).map(_temp2$5));
		$[0] = data.tickets;
		$[1] = filters;
		$[2] = t0;
	} else t0 = $[2];
	const visibleTickets = t0;
	let t1;
	if ($[5] !== data.graph.nodes || $[6] !== filters || $[7] !== visibleTickets) {
		let t2;
		if ($[9] !== filters || $[10] !== visibleTickets) {
			t2 = (node) => (!node.projectId || !filters.project || node.projectId === filters.project) && (!node.ticketId || visibleTickets.has(node.ticketId));
			$[9] = filters;
			$[10] = visibleTickets;
			$[11] = t2;
		} else t2 = $[11];
		const source = data.graph.nodes.filter(t2);
		const columns = /* @__PURE__ */ new Map();
		t1 = source.map((node_0) => {
			const column = node_0.kind === "main" ? 0 : node_0.kind === "supervisor" ? 1 : node_0.kind === "project" ? 2 : node_0.kind === "ticket" ? 3 : 4;
			const row = columns.get(column) ?? 0;
			columns.set(column, row + 1);
			return {
				...node_0,
				kind: node_0.kind === "ticket" ? "task" : node_0.kind === "worker" ? "session" : node_0.kind === "project" ? "route" : "orchestrator",
				subtitle: node_0.sessionId ?? node_0.ticketId ?? node_0.projectId ?? "",
				x: 20 + column * 212,
				y: 30 + row * 95,
				taskId: node_0.ticketId ?? void 0
			};
		});
		$[5] = data.graph.nodes;
		$[6] = filters;
		$[7] = visibleTickets;
		$[8] = t1;
	} else t1 = $[8];
	const nodes = t1;
	let t2;
	if ($[12] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "px-5 py-3",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "m-0 text-sm font-medium",
				children: "编排关系"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 mt-1 text-xs text-[var(--dsw-alias-label-secondary)]",
				children: "真实角色、项目、工单、执行与依赖。选择节点查看工单，不创建会话或连线。"
			})]
		});
		$[12] = t2;
	} else t2 = $[12];
	let t3;
	if ($[13] !== data.graph.edges || $[14] !== nodes) {
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "overflow-hidden rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)]",
			children: [t2, nodes.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GraphCanvas, {
				nodes,
				edges: data.graph.edges
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "p-5",
				children: "当前筛选没有编排节点，请清除筛选。"
			})]
		});
		$[13] = data.graph.edges;
		$[14] = nodes;
		$[15] = t3;
	} else t3 = $[15];
	return t3;
}
function _temp2$5(t0) {
	const { ticket: ticket_0 } = t0;
	return ticket_0.id;
}
function _temp$6(state) {
	return state.filters;
}
// src/client/pages/overview/page.tsx
function Overview() {
	const $ = (0, import_dist.c)(15);
	const { data } = usePanel();
	let t0;
	if ($[0] !== data.projects.length) {
		t0 = ["项目", data.projects.length];
		$[0] = data.projects.length;
		$[1] = t0;
	} else t0 = $[1];
	let t1;
	if ($[2] !== data.tickets.length) {
		t1 = ["工单", data.tickets.length];
		$[2] = data.tickets.length;
		$[3] = t1;
	} else t1 = $[3];
	let t2;
	if ($[4] !== data.inbox.pending.length) {
		t2 = ["需要本人答复", data.inbox.pending.length];
		$[4] = data.inbox.pending.length;
		$[5] = t2;
	} else t2 = $[5];
	let t3;
	if ($[6] !== t0 || $[7] !== t1 || $[8] !== t2) {
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-3 sm:grid-cols-3",
			children: [
				t0,
				t1,
				t2
			].map(_temp$5)
		});
		$[6] = t0;
		$[7] = t1;
		$[8] = t2;
		$[9] = t3;
	} else t3 = $[9];
	let t4;
	let t5;
	let t6;
	if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Filters, {});
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Graph, {});
		t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TicketRows, {});
		$[10] = t4;
		$[11] = t5;
		$[12] = t6;
	} else {
		t4 = $[10];
		t5 = $[11];
		t6 = $[12];
	}
	let t7;
	if ($[13] !== t3) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-5",
			children: [
				t3,
				t4,
				t5,
				t6
			]
		});
		$[13] = t3;
		$[14] = t7;
	} else t7 = $[14];
	return t7;
}
function _temp$5(t0) {
	const [label, value] = t0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 text-xs text-[var(--dsw-alias-label-secondary)]",
			children: label
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mb-0 mt-2 text-2xl tabular-nums",
			children: value
		})]
	}, label);
}
// src/client/components/policy-fields.tsx
function PolicyFields(t0) {
	const $ = (0, import_dist.c)(21);
	const { value, onChange } = t0;
	let t1;
	if ($[0] !== onChange || $[1] !== value) {
		t1 = (event) => onChange({
			...value,
			questionLevel: event.target.value
		});
		$[0] = onChange;
		$[1] = value;
		$[2] = t1;
	} else t1 = $[2];
	let t2;
	let t3;
	let t4;
	if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
		t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "detailed",
			children: "详细 detailed"
		});
		t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "important",
			children: "重要 important"
		});
		t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "automatic",
			children: "自动 automatic"
		});
		$[3] = t2;
		$[4] = t3;
		$[5] = t4;
	} else {
		t2 = $[3];
		t3 = $[4];
		t4 = $[5];
	}
	let t5;
	if ($[6] !== t1 || $[7] !== value.questionLevel) {
		t5 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
			className: "flex flex-col gap-1 text-xs",
			children: ["提问档位", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				className: "rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2",
				value: value.questionLevel,
				onChange: t1,
				children: [
					t2,
					t3,
					t4
				]
			})]
		});
		$[6] = t1;
		$[7] = value.questionLevel;
		$[8] = t5;
	} else t5 = $[8];
	let t6;
	if ($[9] !== onChange || $[10] !== value) {
		t6 = (event_0) => onChange({
			...value,
			mergePolicy: event_0.target.value
		});
		$[9] = onChange;
		$[10] = value;
		$[11] = t6;
	} else t6 = $[11];
	let t7;
	let t8;
	let t9;
	if ($[12] === Symbol.for("react.memo_cache_sentinel")) {
		t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "follow_question_level",
			children: "跟随提问档位"
		});
		t8 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "human_required",
			children: "必须本人答复"
		});
		t9 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
			value: "automatic_allowed",
			children: "允许授权代理决定"
		});
		$[12] = t7;
		$[13] = t8;
		$[14] = t9;
	} else {
		t7 = $[12];
		t8 = $[13];
		t9 = $[14];
	}
	let t10;
	if ($[15] !== t6 || $[16] !== value.mergePolicy) {
		t10 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
			className: "flex flex-col gap-1 text-xs",
			children: ["合并策略", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				className: "rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2",
				value: value.mergePolicy,
				onChange: t6,
				children: [
					t7,
					t8,
					t9
				]
			})]
		});
		$[15] = t6;
		$[16] = value.mergePolicy;
		$[17] = t10;
	} else t10 = $[17];
	let t11;
	if ($[18] !== t10 || $[19] !== t5) {
		t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-4",
			children: [t5, t10]
		});
		$[18] = t10;
		$[19] = t5;
		$[20] = t11;
	} else t11 = $[20];
	return t11;
}
// src/client/pages/setting/page.tsx
function Setting() {
	const $ = (0, import_dist.c)(49);
	const { data } = usePanel();
	const command = useCommand();
	const [section, setSection] = (0, react.useState)("projects");
	const [query, setQuery] = (0, react.useState)("");
	const [result, setResult] = (0, react.useState)("");
	let t0;
	if ($[0] !== data.settings) {
		t0 = () => ({
			...data.settings,
			whitelist: data.settings.whitelist.join(", ")
		});
		$[0] = data.settings;
		$[1] = t0;
	} else t0 = $[1];
	const [draft, setDraft] = (0, react.useState)(t0);
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	let t6;
	if ($[2] !== command || $[3] !== data.projects || $[4] !== data.settings || $[5] !== draft || $[6] !== query || $[7] !== section) {
		let t7;
		if ($[14] !== query) {
			t7 = (project) => [
				project.name,
				project.directory,
				project.repository
			].join(" ").toLowerCase().includes(query.toLowerCase());
			$[14] = query;
			$[15] = t7;
		} else t7 = $[15];
		const projects = data.projects.filter(t7);
		let t8;
		if ($[16] !== draft.defaultMergePolicy || $[17] !== draft.defaultQuestionLevel) {
			t8 = {
				questionLevel: draft.defaultQuestionLevel,
				mergePolicy: draft.defaultMergePolicy
			};
			$[16] = draft.defaultMergePolicy;
			$[17] = draft.defaultQuestionLevel;
			$[18] = t8;
		} else t8 = $[18];
		const policy = t8;
		const fields = [
			["backgroundLimitMinutes", "后台工作时限（分钟）"],
			["reminderIntervalMinutes", "提醒间隔（分钟）"],
			["deliveryMaxAttempts", "投递失败次数上限"],
			["deliveryRetryCeilingSeconds", "投递重试间隔上限（秒）"]
		];
		t5 = "flex min-w-0 flex-col gap-4";
		if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
			t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "m-0 text-base font-medium",
				children: "自动化范围与全局默认"
			});
			$[19] = t6;
		} else t6 = $[19];
		t3 = "grid min-w-0 gap-4 sm:grid-cols-[150px_minmax(0,1fr)]";
		const t9 = section === "projects" ? "outline" : "ghost";
		let t10;
		if ($[20] === Symbol.for("react.memo_cache_sentinel")) {
			t10 = () => setSection("projects");
			$[20] = t10;
		} else t10 = $[20];
		let t11;
		if ($[21] !== t9) {
			t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: t9,
				onClick: t10,
				children: "项目范围"
			});
			$[21] = t9;
			$[22] = t11;
		} else t11 = $[22];
		const t12 = section === "defaults" ? "outline" : "ghost";
		let t13;
		if ($[23] === Symbol.for("react.memo_cache_sentinel")) {
			t13 = () => setSection("defaults");
			$[23] = t13;
		} else t13 = $[23];
		let t14;
		if ($[24] !== t12) {
			t14 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: t12,
				onClick: t13,
				children: "全局默认"
			});
			$[24] = t12;
			$[25] = t14;
		} else t14 = $[25];
		if ($[26] !== t11 || $[27] !== t14) {
			t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
				"aria-label": "设置分类",
				className: "flex flex-wrap gap-2 self-start sm:flex-col",
				children: [t11, t14]
			});
			$[26] = t11;
			$[27] = t14;
			$[28] = t4;
		} else t4 = $[28];
		t1 = "flex min-w-0 flex-col gap-4";
		t2 = section === "projects" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-xs",
				children: "新发现项目默认禁用；刷新保留已有选择。失联或禁用项目保留历史，不派工。"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["搜索项目", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "search",
						value: query,
						onChange: (event) => setQuery(event.target.value),
						className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1"
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						disabled: command.busy,
						onClick: () => void command.run("刷新 Git 工作区", _temp$4),
						children: "刷新 Git 工作区"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "text-xs",
						children: [
							"已启用",
							data.projects.filter(_temp2$4).length,
							" ",
							"/",
							data.projects.length
						]
					})
				]
			}),
			projects.map((project_1) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: !!project_1.enabled,
								disabled: command.busy || !project_1.enabled && (!project_1.available || !project_1.repository),
								onChange: (event_0) => {
									const enabled = event_0.target.checked;
									command.run((enabled ? "启用项目 " : "禁用项目 ") + project_1.name, async () => {
										const result_0 = await nexus.project(project_1.id, enabled);
										setResult(JSON.stringify(result_0));
										const failures = result_0.interruptions.filter(_temp3$2);
										return failures.length ? `项目选择已保存，但会话尚未中断：${failures.map(_temp4$1).join(", ")}` : "项目选择已保存；不会因此虚构派工或完成。";
									});
								}
							}),
							project_1.name,
							" ",
							"·",
							project_1.available ? "可用" : "不可用，保留历史",
							" ",
							"·",
							project_1.enabled ? "已启用" : "已禁用"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "mb-0 break-all font-mono text-xs text-[var(--dsw-alias-label-secondary)]",
						children: [
							project_1.directory,
							" ",
							"·",
							" ",
							project_1.repository ?? "仓库身份未核验"
						]
					}),
					project_1.attentionReason && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "mb-0 text-xs",
						children: project_1.attentionReason
					})
				]
			}, project_1.id)),
			!data.projects.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚未发现 Git 项目。请在宿主添加带 remote 的 Git 工作区，再刷新。" }) : !projects.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "没有匹配项目；历史记录没有被删除。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "outline",
				onClick: () => setQuery(""),
				children: "清除搜索"
			})] })
		] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			onSubmit: (event_1) => {
				event_1.preventDefault();
				command.run("保存全局默认", async () => {
					const patch = {
						defaultQuestionLevel: draft.defaultQuestionLevel,
						defaultMergePolicy: draft.defaultMergePolicy,
						whitelist: draft.whitelist.split(",").map(_temp5$1).filter(Boolean),
						maxWorkers: draft.maxWorkers,
						backgroundLimitMinutes: draft.backgroundLimitMinutes,
						reminderIntervalMinutes: draft.reminderIntervalMinutes,
						deliveryMaxAttempts: draft.deliveryMaxAttempts,
						deliveryRetryCeilingSeconds: draft.deliveryRetryCeilingSeconds
					};
					await nexus.settings(patch);
				});
			},
			className: "flex flex-col gap-5",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs",
				children: "全局提问档位与合并策略只影响新工单，不会改变既有工单快照。修改已有票，请到工单详情单独编辑。"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
				disabled: command.busy,
				className: "m-0 flex flex-col gap-5 border-0 p-0",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PolicyFields, {
						value: policy,
						onChange: (value_0) => setDraft((previous) => ({
							...previous,
							defaultQuestionLevel: value_0.questionLevel,
							defaultMergePolicy: value_0.mergePolicy
						}))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "flex max-w-sm flex-col gap-1 text-xs",
						children: ["Worker 并发上限（1–16）", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: 16,
							step: 1,
							required: true,
							value: draft.maxWorkers,
							onChange: (event_2) => setDraft((previous_0) => ({
								...previous_0,
								maxWorkers: event_2.target.valueAsNumber
							})),
							className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "flex flex-col gap-1 text-xs",
						children: ["GitHub 人工答复白名单（login，逗号分隔）", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							value: draft.whitelist,
							onChange: (event_3) => setDraft((previous_1) => ({
								...previous_1,
								whitelist: event_3.target.value
							})),
							className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
						className: "cursor-pointer",
						children: "高级运行与投递参数"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-4 sm:grid-cols-2",
						children: fields.map((t15) => {
							const [key, label] = t15;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs",
								children: [label, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									required: true,
									min: 1,
									step: 1,
									value: draft[key],
									onChange: (event_4) => setDraft((previous_2) => ({
										...previous_2,
										[key]: event_4.target.valueAsNumber
									})),
									className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2"
								})]
							}, key);
						})
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							type: "submit",
							size: "sm",
							variant: "outline",
							children: command.busy ? "正在保存…" : "保存全局默认"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => setDraft({
								...data.settings,
								whitelist: data.settings.whitelist.join(", ")
							}),
							children: "撤销草稿"
						})]
					})
				]
			})]
		});
		$[2] = command;
		$[3] = data.projects;
		$[4] = data.settings;
		$[5] = draft;
		$[6] = query;
		$[7] = section;
		$[8] = t1;
		$[9] = t2;
		$[10] = t3;
		$[11] = t4;
		$[12] = t5;
		$[13] = t6;
	} else {
		t1 = $[8];
		t2 = $[9];
		t3 = $[10];
		t4 = $[11];
		t5 = $[12];
		t6 = $[13];
	}
	let t7;
	if ($[29] !== command.feedback) {
		t7 = command.feedback && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			className: "m-0 text-xs",
			children: command.feedback
		});
		$[29] = command.feedback;
		$[30] = t7;
	} else t7 = $[30];
	let t8;
	if ($[31] !== command.error) {
		t8 = command.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "alert",
			className: "m-0 text-xs text-[var(--dsw-alias-state-error-primary)]",
			children: command.error
		});
		$[31] = command.error;
		$[32] = t8;
	} else t8 = $[32];
	let t9;
	if ($[33] !== result) {
		t9 = result && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "最近项目操作结果" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
			className: "whitespace-pre-wrap break-all text-xs",
			children: result
		})] });
		$[33] = result;
		$[34] = t9;
	} else t9 = $[34];
	let t10;
	if ($[35] !== t1 || $[36] !== t2 || $[37] !== t7 || $[38] !== t8 || $[39] !== t9) {
		t10 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: t1,
			children: [
				t2,
				t7,
				t8,
				t9
			]
		});
		$[35] = t1;
		$[36] = t2;
		$[37] = t7;
		$[38] = t8;
		$[39] = t9;
		$[40] = t10;
	} else t10 = $[40];
	let t11;
	if ($[41] !== t10 || $[42] !== t3 || $[43] !== t4) {
		t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: t3,
			children: [t4, t10]
		});
		$[41] = t10;
		$[42] = t3;
		$[43] = t4;
		$[44] = t11;
	} else t11 = $[44];
	let t12;
	if ($[45] !== t11 || $[46] !== t5 || $[47] !== t6) {
		t12 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: t5,
			children: [t6, t11]
		});
		$[45] = t11;
		$[46] = t5;
		$[47] = t6;
		$[48] = t12;
	} else t12 = $[48];
	return t12;
}
function _temp5$1(value) {
	return value.trim();
}
function _temp4$1(item_0) {
	return `${item_0.bindingId} · ${item_0.reason}`;
}
function _temp3$2(item) {
	return !item.interrupted;
}
function _temp2$4(project_0) {
	return project_0.enabled;
}
async function _temp$4() {
	await nexus.refreshProjects();
}
// src/client/pages/ticket/detail/page.tsx
function TicketDetail() {
	const $ = (0, import_dist.c)(2);
	const id = useStore(_temp$3);
	let t0;
	if ($[0] !== id) {
		t0 = id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Detail, { id }, id) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "未选择工单，请返回工单列表。" });
		$[0] = id;
		$[1] = t0;
	} else t0 = $[1];
	return t0;
}
function _temp$3(state) {
	return state.navigation.ticketId;
}
function Detail(t0) {
	const $ = (0, import_dist.c)(160);
	const { id } = t0;
	const { data } = usePanel();
	const { go, openThread, openTicket } = useActions();
	const returnTo = useStore(_temp2$3);
	const command = useCommand();
	const [reason, setReason] = (0, react.useState)("");
	const [result, setResult] = (0, react.useState)("");
	const [armed, setArmed] = (0, react.useState)(false);
	let t1;
	if ($[0] !== data.tickets || $[1] !== id) {
		t1 = data.tickets.find((item) => item.ticket.id === id)?.ticket;
		$[0] = data.tickets;
		$[1] = id;
		$[2] = t1;
	} else t1 = $[2];
	const current = t1;
	let t2;
	if ($[3] !== current) {
		t2 = () => current ? {
			questionLevel: current.questionLevel,
			mergePolicy: current.mergePolicy
		} : null;
		$[3] = current;
		$[4] = t2;
	} else t2 = $[4];
	const [policy, setPolicy] = (0, react.useState)(t2);
	let t3;
	if ($[5] !== id) {
		t3 = () => nexus.ticket(id);
		$[5] = id;
		$[6] = t3;
	} else t3 = $[6];
	let t4;
	if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
		t4 = { resetOnExecute: false };
		$[7] = t4;
	} else t4 = $[7];
	const resource = useAsyncState(t3, null, t4);
	let t5;
	if ($[8] !== resource) {
		t5 = () => {
			resource.executeImmediate();
		};
		$[8] = resource;
		$[9] = t5;
	} else t5 = $[9];
	const reload = t5;
	useEventListener("focus", reload);
	useEventListener("online", reload);
	let t6;
	if ($[10] !== reload || $[11] !== resource.isLoading) {
		t6 = () => {
			if (document.visibilityState === "visible" && !resource.isLoading) reload();
		};
		$[10] = reload;
		$[11] = resource.isLoading;
		$[12] = t6;
	} else t6 = $[12];
	useIntervalFn(t6, 15e3);
	const detail = resource.state;
	if (!current) {
		let t7;
		if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
			t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "工单不存在或已不可读取。" });
			$[13] = t7;
		} else t7 = $[13];
		let t8;
		if ($[14] !== go) {
			t8 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [t7, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "outline",
				onClick: () => go("ticket"),
				children: "返回工单列表"
			})] });
			$[14] = go;
			$[15] = t8;
		} else t8 = $[15];
		return t8;
	}
	let t7;
	if ($[16] !== data.inbox.pending || $[17] !== data.inbox.resolved || $[18] !== id) {
		t7 = [...data.inbox.pending, ...data.inbox.resolved].filter((ask) => ask.ticketIds.includes(id));
		$[16] = data.inbox.pending;
		$[17] = data.inbox.resolved;
		$[18] = id;
		$[19] = t7;
	} else t7 = $[19];
	const asks = t7;
	let t8;
	if ($[20] !== current.deliveryTarget) {
		t8 = current.deliveryTarget ? JSON.parse(current.deliveryTarget) : null;
		$[20] = current.deliveryTarget;
		$[21] = t8;
	} else t8 = $[21];
	const target = t8;
	let t9;
	if ($[22] !== go || $[23] !== returnTo) {
		t9 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			variant: "ghost",
			size: "sm",
			onClick: () => go(returnTo),
			children: "返回"
		}) });
		$[22] = go;
		$[23] = returnTo;
		$[24] = t9;
	} else t9 = $[24];
	let t10;
	if ($[25] !== current.title) {
		t10 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
			className: "m-0 text-lg font-medium",
			children: current.title
		});
		$[25] = current.title;
		$[26] = t10;
	} else t10 = $[26];
	let t11;
	if ($[27] !== current.id) {
		t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "font-mono text-xs",
			children: current.id
		});
		$[27] = current.id;
		$[28] = t11;
	} else t11 = $[28];
	const t12 = current.paused || current.failureReason ? "warning" : "quiet";
	const t13 = current.paused ? "paused" : current.status;
	let t14;
	if ($[29] !== t12 || $[30] !== t13) {
		t14 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
			tone: t12,
			children: t13
		});
		$[29] = t12;
		$[30] = t13;
		$[31] = t14;
	} else t14 = $[31];
	let t15;
	if ($[32] !== t10 || $[33] !== t11 || $[34] !== t14) {
		t15 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-center gap-3",
			children: [
				t10,
				t11,
				t14
			]
		});
		$[32] = t10;
		$[33] = t11;
		$[34] = t14;
		$[35] = t15;
	} else t15 = $[35];
	let t16;
	if ($[36] === Symbol.for("react.memo_cache_sentinel")) {
		t16 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
			className: "m-0 text-sm font-medium",
			children: "目标与授权范围"
		});
		$[36] = t16;
	} else t16 = $[36];
	const t17 = current.description ?? current.title;
	let t18;
	if ($[37] !== t17) {
		t18 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "whitespace-pre-wrap",
			children: t17
		});
		$[37] = t17;
		$[38] = t18;
	} else t18 = $[38];
	let t19;
	if ($[39] !== current.authorization) {
		t19 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mb-0 whitespace-pre-wrap text-xs",
			children: current.authorization
		});
		$[39] = current.authorization;
		$[40] = t19;
	} else t19 = $[40];
	let t20;
	if ($[41] !== t18 || $[42] !== t19) {
		t20 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
			className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
			children: [
				t16,
				t18,
				t19
			]
		});
		$[41] = t18;
		$[42] = t19;
		$[43] = t20;
	} else t20 = $[43];
	let t21;
	if ($[44] === Symbol.for("react.memo_cache_sentinel")) {
		t21 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
			className: "m-0 text-sm font-medium",
			children: "验收要求"
		});
		$[44] = t21;
	} else t21 = $[44];
	let t22;
	if ($[45] !== current.acceptanceCriteria) {
		t22 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
			className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
			children: [t21, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "mb-0 whitespace-pre-wrap",
				children: current.acceptanceCriteria
			})]
		});
		$[45] = current.acceptanceCriteria;
		$[46] = t22;
	} else t22 = $[46];
	let t23;
	if ($[47] !== t20 || $[48] !== t22) {
		t23 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 sm:grid-cols-2",
			children: [t20, t22]
		});
		$[47] = t20;
		$[48] = t22;
		$[49] = t23;
	} else t23 = $[49];
	let t24;
	if ($[50] !== current.mergePolicy || $[51] !== current.policyRevision || $[52] !== current.questionLevel) {
		t24 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "m-0 text-xs",
			children: [
				"实际快照：",
				current.questionLevel,
				" ",
				"·",
				current.mergePolicy,
				" ",
				"· revision",
				current.policyRevision,
				"。全局默认不追溯修改本票。"
			]
		});
		$[50] = current.mergePolicy;
		$[51] = current.policyRevision;
		$[52] = current.questionLevel;
		$[53] = t24;
	} else t24 = $[53];
	let t25;
	if ($[54] !== current.executionAttention || $[55] !== current.failureReason || $[56] !== current.pauseReason || $[57] !== current.prepareError) {
		t25 = (current.pauseReason || current.failureReason || current.executionAttention || current.prepareError) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			role: "status",
			className: "m-0 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3",
			children: ["暂停/故障：", [
				current.pauseReason,
				current.failureReason,
				current.executionAttention,
				current.prepareError
			].filter(Boolean).join(" · ")]
		});
		$[54] = current.executionAttention;
		$[55] = current.failureReason;
		$[56] = current.pauseReason;
		$[57] = current.prepareError;
		$[58] = t25;
	} else t25 = $[58];
	let t26;
	if ($[59] === Symbol.for("react.memo_cache_sentinel")) {
		t26 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
			className: "m-0 text-sm font-medium",
			children: "当前 PR / CI 事实"
		});
		$[59] = t26;
	} else t26 = $[59];
	const t27 = current.prUrl ?? "未关联 PR";
	let t28;
	if ($[60] !== current.prUrl || $[61] !== t27) {
		t28 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceLink, {
			href: current.prUrl,
			children: t27
		});
		$[60] = current.prUrl;
		$[61] = t27;
		$[62] = t28;
	} else t28 = $[62];
	const t29 = current.prState ?? "尚未观测";
	const t30 = current.ciState ?? "尚未观测";
	let t31;
	if ($[63] !== t28 || $[64] !== t29 || $[65] !== t30) {
		t31 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "mb-0",
			children: [
				t28,
				" ",
				"· PR",
				" ",
				t29,
				" ",
				"· CI",
				" ",
				t30
			]
		});
		$[63] = t28;
		$[64] = t29;
		$[65] = t30;
		$[66] = t31;
	} else t31 = $[66];
	let t32;
	if ($[67] !== target) {
		t32 = target && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "mb-0 break-all font-mono text-xs",
			children: [
				"base",
				target.base,
				" ",
				"· head",
				target.head
			]
		});
		$[67] = target;
		$[68] = t32;
	} else t32 = $[68];
	let t33;
	if ($[69] === Symbol.for("react.memo_cache_sentinel")) {
		t33 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mb-0 text-xs text-[var(--dsw-alias-label-secondary)]",
			children: "review、PR open、工具受理都不代表完成；成功交付、取消、未合并关闭分别展示。"
		});
		$[69] = t33;
	} else t33 = $[69];
	let t34;
	if ($[70] !== t31 || $[71] !== t32) {
		t34 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
			className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
			children: [
				t26,
				t31,
				t32,
				t33
			]
		});
		$[70] = t31;
		$[71] = t32;
		$[72] = t34;
	} else t34 = $[72];
	let t35;
	if ($[73] === Symbol.for("react.memo_cache_sentinel")) {
		t35 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
			className: "cursor-pointer",
			children: "管理本工单与实际策略"
		});
		$[73] = t35;
	} else t35 = $[73];
	let t36;
	if ($[74] !== id) {
		t36 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "m-0 text-xs",
			children: [
				"作用范围：仅工单",
				id,
				"。解除人工暂停不自动重试；重试须核实旧执行与外部副作用。"
			]
		});
		$[74] = id;
		$[75] = t36;
	} else t36 = $[75];
	let t37;
	if ($[76] === Symbol.for("react.memo_cache_sentinel")) {
		t37 = (event) => setReason(event.target.value);
		$[76] = t37;
	} else t37 = $[76];
	let t38;
	if ($[77] !== reason) {
		t38 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
			className: "flex flex-col gap-1 text-xs",
			children: ["处置原因", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				value: reason,
				onChange: t37,
				className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2"
			})]
		});
		$[77] = reason;
		$[78] = t38;
	} else t38 = $[78];
	let t39;
	if ($[79] === Symbol.for("react.memo_cache_sentinel")) {
		t39 = [
			"pause",
			"resume",
			"retry",
			"dispatch"
		];
		$[79] = t39;
	} else t39 = $[79];
	let t40;
	if ($[80] !== command || $[81] !== current.paused || $[82] !== id || $[83] !== reason || $[84] !== reload) {
		t40 = t39.map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			disabled: command.busy || !reason.trim() && action !== "dispatch" || action === "resume" && !current.paused || action === "pause" && !!current.paused,
			onClick: () => void command.run(`工单 ${action}`, async () => {
				const result_0 = await nexus.command(id, action, reason);
				setResult(JSON.stringify(result_0));
				reload();
			}, action === "dispatch" ? "派工已受理，尚不代表 Worker 已启动或工单完成。" : "管理决定已记录，请核对下方实际停止/运行结果。"),
			children: action
		}, action));
		$[80] = command;
		$[81] = current.paused;
		$[82] = id;
		$[83] = reason;
		$[84] = reload;
		$[85] = t40;
	} else t40 = $[85];
	let t41;
	if ($[86] !== command.busy || $[87] !== reason) {
		t41 = command.busy || !reason.trim();
		$[86] = command.busy;
		$[87] = reason;
		$[88] = t41;
	} else t41 = $[88];
	let t42;
	if ($[89] !== armed || $[90] !== command || $[91] !== id || $[92] !== reason || $[93] !== reload) {
		t42 = () => {
			if (!armed) {
				setArmed(true);
				return;
			}
			command.run("取消工单", async () => {
				const result_1 = await nexus.command(id, "cancel", reason);
				setResult(JSON.stringify(result_1));
				setArmed(false);
				reload();
			}, "取消决定已记录，请核对旧执行停止结果。");
		};
		$[89] = armed;
		$[90] = command;
		$[91] = id;
		$[92] = reason;
		$[93] = reload;
		$[94] = t42;
	} else t42 = $[94];
	const t43 = armed ? "再次点击：取消本工单" : "取消工单";
	let t44;
	if ($[95] !== t41 || $[96] !== t42 || $[97] !== t43) {
		t44 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			disabled: t41,
			onClick: t42,
			children: t43
		});
		$[95] = t41;
		$[96] = t42;
		$[97] = t43;
		$[98] = t44;
	} else t44 = $[98];
	let t45;
	if ($[99] !== t40 || $[100] !== t44) {
		t45 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [t40, t44]
		});
		$[99] = t40;
		$[100] = t44;
		$[101] = t45;
	} else t45 = $[101];
	let t46;
	if ($[102] !== policy) {
		t46 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PolicyFields, {
			value: policy,
			onChange: setPolicy
		});
		$[102] = policy;
		$[103] = t46;
	} else t46 = $[103];
	let t47;
	if ($[104] !== command.busy || $[105] !== t46) {
		t47 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("fieldset", {
			disabled: command.busy,
			className: "m-0 border-0 p-0",
			children: t46
		});
		$[104] = command.busy;
		$[105] = t46;
		$[106] = t47;
	} else t47 = $[106];
	let t48;
	if ($[107] !== command.busy || $[108] !== reason) {
		t48 = command.busy || !reason.trim();
		$[107] = command.busy;
		$[108] = reason;
		$[109] = t48;
	} else t48 = $[109];
	let t49;
	if ($[110] !== command || $[111] !== id || $[112] !== policy || $[113] !== reason || $[114] !== reload) {
		t49 = () => void command.run("修改本票策略", async () => {
			await nexus.policy(id, policy, reason);
			reload();
		});
		$[110] = command;
		$[111] = id;
		$[112] = policy;
		$[113] = reason;
		$[114] = reload;
		$[115] = t49;
	} else t49 = $[115];
	let t50;
	if ($[116] !== t48 || $[117] !== t49) {
		t50 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			disabled: t48,
			onClick: t49,
			children: "保存本票策略"
		});
		$[116] = t48;
		$[117] = t49;
		$[118] = t50;
	} else t50 = $[118];
	let t51;
	if ($[119] !== command.feedback) {
		t51 = command.feedback && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			className: "m-0 text-xs",
			children: command.feedback
		});
		$[119] = command.feedback;
		$[120] = t51;
	} else t51 = $[120];
	let t52;
	if ($[121] !== command.error) {
		t52 = command.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "alert",
			className: "m-0 text-xs text-[var(--dsw-alias-state-error-primary)]",
			children: command.error
		});
		$[121] = command.error;
		$[122] = t52;
	} else t52 = $[122];
	let t53;
	if ($[123] !== result) {
		t53 = result && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
			className: "m-0 whitespace-pre-wrap break-all text-xs",
			children: result
		});
		$[123] = result;
		$[124] = t53;
	} else t53 = $[124];
	let t54;
	if ($[125] !== t36 || $[126] !== t38 || $[127] !== t45 || $[128] !== t47 || $[129] !== t50 || $[130] !== t51 || $[131] !== t52 || $[132] !== t53) {
		t54 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [t35, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex flex-col gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
			children: [
				t36,
				t38,
				t45,
				t47,
				t50,
				t51,
				t52,
				t53
			]
		})] });
		$[125] = t36;
		$[126] = t38;
		$[127] = t45;
		$[128] = t47;
		$[129] = t50;
		$[130] = t51;
		$[131] = t52;
		$[132] = t53;
		$[133] = t54;
	} else t54 = $[133];
	let t55;
	if ($[134] !== detail || $[135] !== reload || $[136] !== resource.error) {
		t55 = resource.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			role: "alert",
			children: [
				"读取工单详情失败：",
				String(resource.error),
				"。",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					onClick: reload,
					children: "重读详情"
				})
			]
		}) : !detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			children: "正在读取执行、依赖、产物与历史…"
		});
		$[134] = detail;
		$[135] = reload;
		$[136] = resource.error;
		$[137] = t55;
	} else t55 = $[137];
	let t56;
	if ($[138] !== detail || $[139] !== openThread || $[140] !== openTicket) {
		t56 = detail && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: "m-0 text-sm font-medium",
					children: "执行历史与来源会话"
				}), detail.executions.length ? detail.executions.map(_temp3$1) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 text-xs",
					children: "尚未创建执行；派工受理不产生虚构会话。"
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "text-sm font-medium",
				children: "依赖与关联"
			}), detail.dependencies.length ? detail.dependencies.map((link) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "flex flex-wrap items-center gap-2 text-xs",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => openTicket(link.ticketId),
						children: link.ticketId
					}),
					link.kind,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => openTicket(link.relatedId),
						children: link.relatedId
					}),
					link.satisfiedAt ? `成功依赖已满足 ${link.satisfiedAt}` : "尚无成功依赖事实"
				]
			}, link.ticketId + link.relatedId)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs",
				children: "没有关联依赖。"
			})] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "text-sm font-medium",
				children: "来源话题与订阅"
			}), detail.topics.length ? detail.topics.map((topic) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => openThread(topic.id),
				children: topic.title
			}, topic.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs",
				children: "未关联来源话题。"
			})] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: "text-sm font-medium",
					children: "产物与验收证据"
				}),
				detail.evidence.map(_temp4),
				detail.messages.filter(_temp5).map(_temp6),
				!detail.evidence.length && !detail.messages.some(_temp7) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-xs",
					children: "尚无已记录产物或验收证据。"
				})
			] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "事件与投递历史" }),
				detail.history.map(_temp8),
				detail.messages.map(_temp9)
			] })
		] });
		$[138] = detail;
		$[139] = openThread;
		$[140] = openTicket;
		$[141] = t56;
	} else t56 = $[141];
	let t57;
	if ($[142] === Symbol.for("react.memo_cache_sentinel")) {
		t57 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
			className: "m-0 text-sm font-medium",
			children: "待决问题与生效答案"
		});
		$[142] = t57;
	} else t57 = $[142];
	let t58;
	if ($[143] !== asks) {
		t58 = asks.map(_temp0);
		$[143] = asks;
		$[144] = t58;
	} else t58 = $[144];
	let t59;
	if ($[145] !== asks || $[146] !== detail?.asks) {
		t59 = detail?.asks.filter((ask_1) => !asks.some((item_2) => item_2.id === ask_1.id)).map(_temp1);
		$[145] = asks;
		$[146] = detail?.asks;
		$[147] = t59;
	} else t59 = $[147];
	let t60;
	if ($[148] !== t15 || $[149] !== t23 || $[150] !== t24 || $[151] !== t25 || $[152] !== t34 || $[153] !== t54 || $[154] !== t55 || $[155] !== t56 || $[156] !== t58 || $[157] !== t59 || $[158] !== t9) {
		t60 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex min-w-0 flex-col gap-4",
			children: [
				t9,
				t15,
				t23,
				t24,
				t25,
				t34,
				t54,
				t55,
				t56,
				t57,
				t58,
				t59
			]
		});
		$[148] = t15;
		$[149] = t23;
		$[150] = t24;
		$[151] = t25;
		$[152] = t34;
		$[153] = t54;
		$[154] = t55;
		$[155] = t56;
		$[156] = t58;
		$[157] = t59;
		$[158] = t9;
		$[159] = t60;
	} else t60 = $[159];
	return t60;
}
function _temp1(ask_2) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "text-xs",
		children: [
			ask_2.content,
			" ",
			"·",
			" ",
			ask_2.status,
			" ",
			"· 当前责任",
			" ",
			ask_2.handler,
			"（非本人待办）"
		]
	}, ask_2.id);
}
function _temp0(ask_0) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AskCard, { ask: ask_0 }, ask_0.id);
}
function _temp9(message_2) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "break-all text-xs",
		children: [
			message_2.kind,
			" ",
			"·",
			" ",
			message_2.recipient,
			" ",
			"·",
			" ",
			message_2.error ? `投递失败：${message_2.error}` : message_2.handledAt ? "已处理" : message_2.readAt ? "已入上下文" : message_2.deliveredAt ? "已送达，待入上下文" : "待投递"
		]
	}, message_2.id);
}
function _temp8(item_1) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "break-all text-xs",
		children: [
			item_1.at,
			" ",
			"·",
			" ",
			item_1.event,
			" ",
			"·",
			" ",
			item_1.fromStatus,
			" ",
			"→",
			" ",
			item_1.toStatus,
			" ",
			"·",
			" ",
			item_1.reason
		]
	}, item_1.id);
}
function _temp7(message_1) {
	return message_1.facts;
}
function _temp6(message_0) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "break-all text-xs",
		children: [
			message_0.facts,
			" ",
			"· 来源",
			" ",
			message_0.sender,
			" ",
			"·",
			" ",
			message_0.acceptedAt
		]
	}, message_0.id);
}
function _temp5(message) {
	return message.facts;
}
function _temp4(item_0) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "mb-2 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs",
		children: [
			item_0.verdict,
			" ",
			"·",
			" ",
			item_0.scope,
			" ",
			"·",
			" ",
			item_0.criteria,
			" ",
			"·",
			" ",
			item_0.basis,
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "mb-0 whitespace-pre-wrap break-all",
				children: item_0.evidence
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "mb-0",
				children: [
					item_0.executionBindingId,
					" ",
					"·",
					" ",
					item_0.createdAt
				]
			})
		]
	}, item_0.id);
}
function _temp3$1(binding) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "mt-0 text-xs",
				children: [
					binding.role,
					" ",
					"·",
					" ",
					binding.status,
					" ",
					"·",
					" ",
					binding.startedAt ?? "尚未核实启动",
					" ",
					"·",
					" ",
					binding.closedAt ?? "未关闭"
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "break-all font-mono text-xs",
				children: [
					binding.repository,
					" ",
					"·",
					" ",
					binding.worktree,
					" ",
					"·",
					" ",
					binding.branch
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceSession, { sessionId: binding.sessionId }, binding.sessionId)
		]
	}, binding.id);
}
function _temp2$3(state) {
	return state.navigation.returnTo;
}
// src/client/pages/trigger/detail/page.tsx
function TriggerDetail() {
	const $ = (0, import_dist.c)(18);
	const { data } = usePanel();
	const { go, openTicket } = useActions();
	const id = useStore(_temp$2);
	let t0;
	if ($[0] !== data.topics.threads || $[1] !== id) {
		let t1;
		if ($[3] !== id) {
			t1 = (thread) => thread.id === id;
			$[3] = id;
			$[4] = t1;
		} else t1 = $[4];
		t0 = data.topics.threads.find(t1);
		$[0] = data.topics.threads;
		$[1] = id;
		$[2] = t0;
	} else t0 = $[2];
	const thread_0 = t0;
	let t1;
	if ($[5] !== data.topics.subscriptions || $[6] !== data.topics.triggers || $[7] !== go || $[8] !== id || $[9] !== openTicket || $[10] !== thread_0) {
		let t2;
		if ($[12] !== id) {
			t2 = (trigger) => trigger.threadId === id;
			$[12] = id;
			$[13] = t2;
		} else t2 = $[13];
		const events = data.topics.triggers.filter(t2).sort(_temp2$2);
		let t3;
		if ($[14] !== id) {
			t3 = (link) => link.threadId === id;
			$[14] = id;
			$[15] = t3;
		} else t3 = $[15];
		const subscriptions = data.topics.subscriptions.filter(t3);
		let t4;
		if ($[16] !== go) {
			t4 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => go("trigger"),
				children: "返回来源话题"
			}) });
			$[16] = go;
			$[17] = t4;
		} else t4 = $[17];
		t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "flex min-w-0 flex-col gap-4",
			children: [t4, thread_0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					className: "m-0 text-lg font-medium",
					children: thread_0.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "text-xs",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceLink, {
							href: thread_0.url,
							children: thread_0.refId
						}),
						" ",
						"·",
						" ",
						thread_0.repository,
						" ",
						"·",
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: "quiet",
							children: thread_0.triage
						})
					]
				})] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [subscriptions.map((link_0) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						onClick: () => openTicket(link_0.ticketId),
						children: link_0.ticketId
					}, link_0.ticketId)), !subscriptions.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "text-xs",
						children: "尚无订阅工单。"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
					className: "m-0 flex list-none flex-col gap-3 p-0",
					children: events.map(_temp3)
				}),
				!events.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "话题已登记，但尚无触发事件。" })
			] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "来源话题不存在，请返回列表刷新。" })]
		});
		$[5] = data.topics.subscriptions;
		$[6] = data.topics.triggers;
		$[7] = go;
		$[8] = id;
		$[9] = openTicket;
		$[10] = thread_0;
		$[11] = t1;
	} else t1 = $[11];
	return t1;
}
function _temp3(event) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "rounded-xl border border-[var(--dsw-alias-border-l3)] p-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap gap-2 text-xs text-[var(--dsw-alias-label-secondary)]",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: event.actorLogin ?? event.actorName ?? "未知作者" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						event.kind,
						" ",
						"·",
						" ",
						event.at
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						event.human ? "已核验人类来源" : "非人工授权来源",
						" ",
						"·",
						" ",
						event.mentioned ? "提及 Nexus" : "未提及"
					] })
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "whitespace-pre-wrap break-words",
				children: event.text
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceLink, {
				href: event.url,
				children: "打开原始事件"
			})
		]
	}, event.id);
}
function _temp2$2(a, b) {
	return b.at.localeCompare(a.at);
}
function _temp$2(state) {
	return state.trigger.selectedId;
}
// src/client/pages/trigger/page.tsx
function Trigger() {
	const $ = (0, import_dist.c)(53);
	const { data } = usePanel();
	const { openThread } = useActions();
	const [query, setQuery] = (0, react.useState)("");
	const [kind, setKind] = (0, react.useState)("");
	const [triage, setTriage] = (0, react.useState)("");
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	let topics;
	if ($[0] !== data.topics.subscriptions || $[1] !== data.topics.threads || $[2] !== data.topics.triggers || $[3] !== kind || $[4] !== openThread || $[5] !== query || $[6] !== triage) {
		let t5;
		if ($[13] !== kind || $[14] !== query || $[15] !== triage) {
			t5 = (thread) => (!kind || thread.kind === kind) && (!triage || thread.triage === triage) && [
				thread.title,
				thread.repository,
				thread.refId
			].join(" ").toLowerCase().includes(query.toLowerCase());
			$[13] = kind;
			$[14] = query;
			$[15] = triage;
			$[16] = t5;
		} else t5 = $[16];
		topics = data.topics.threads.filter(t5);
		t0 = "flex min-w-0 flex-col gap-4";
		if ($[17] === Symbol.for("react.memo_cache_sentinel")) {
			t1 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "m-0 text-base font-medium",
				children: "来源话题与触发"
			});
			$[17] = t1;
		} else t1 = $[17];
		if ($[18] !== data.topics.subscriptions.length || $[19] !== data.topics.threads.length || $[20] !== data.topics.triggers.length) {
			t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "m-0 text-xs text-[var(--dsw-alias-label-secondary)]",
				children: [
					"已登记",
					data.topics.threads.length,
					" ",
					"个话题 ·",
					data.topics.triggers.length,
					" ",
					"条触发 ·",
					data.topics.subscriptions.length,
					" ",
					"个工单订阅。收到事件不等于已派工。"
				]
			});
			$[18] = data.topics.subscriptions.length;
			$[19] = data.topics.threads.length;
			$[20] = data.topics.triggers.length;
			$[21] = t2;
		} else t2 = $[21];
		let t6;
		if ($[22] === Symbol.for("react.memo_cache_sentinel")) {
			t6 = (event) => setQuery(event.target.value);
			$[22] = t6;
		} else t6 = $[22];
		let t7;
		if ($[23] !== query) {
			t7 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["搜索", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				type: "search",
				value: query,
				onChange: t6,
				className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1"
			})] });
			$[23] = query;
			$[24] = t7;
		} else t7 = $[24];
		let t8;
		if ($[25] === Symbol.for("react.memo_cache_sentinel")) {
			t8 = (event_0) => setKind(event_0.target.value);
			$[25] = t8;
		} else t8 = $[25];
		let t10;
		let t9;
		if ($[26] === Symbol.for("react.memo_cache_sentinel")) {
			t9 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
				value: "",
				children: "全部"
			});
			t10 = [
				"issue",
				"pull",
				"ci",
				"chat"
			].map(_temp$1);
			$[26] = t10;
			$[27] = t9;
		} else {
			t10 = $[26];
			t9 = $[27];
		}
		let t11;
		if ($[28] !== kind) {
			t11 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["话题类型", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				value: kind,
				onChange: t8,
				className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1",
				children: [t9, t10]
			})] });
			$[28] = kind;
			$[29] = t11;
		} else t11 = $[29];
		let t12;
		if ($[30] === Symbol.for("react.memo_cache_sentinel")) {
			t12 = (event_1) => setTriage(event_1.target.value);
			$[30] = t12;
		} else t12 = $[30];
		let t13;
		let t14;
		if ($[31] === Symbol.for("react.memo_cache_sentinel")) {
			t13 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
				value: "",
				children: "全部"
			});
			t14 = [
				"pending",
				"claimed",
				"ignored"
			].map(_temp2$1);
			$[31] = t13;
			$[32] = t14;
		} else {
			t13 = $[31];
			t14 = $[32];
		}
		let t15;
		if ($[33] !== triage) {
			t15 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["分诊", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				value: triage,
				onChange: t12,
				className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1",
				children: [t13, t14]
			})] });
			$[33] = triage;
			$[34] = t15;
		} else t15 = $[34];
		if ($[35] !== t11 || $[36] !== t15 || $[37] !== t7) {
			t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-3",
				children: [
					t7,
					t11,
					t15
				]
			});
			$[35] = t11;
			$[36] = t15;
			$[37] = t7;
			$[38] = t3;
		} else t3 = $[38];
		let t16;
		if ($[39] !== data.topics.subscriptions || $[40] !== data.topics.triggers || $[41] !== openThread) {
			t16 = (thread_0) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "flex flex-wrap items-center gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] px-4 py-3",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => openThread(thread_0.id),
						children: thread_0.title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: "quiet",
						children: [
							thread_0.kind,
							" ",
							"·",
							" ",
							thread_0.triage
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "break-all text-xs text-[var(--dsw-alias-label-secondary)]",
						children: [
							thread_0.repository ?? thread_0.attentionReason ?? "仓库尚未核验",
							" ",
							"·",
							" ",
							data.topics.triggers.filter((trigger) => trigger.threadId === thread_0.id).length,
							" ",
							"条事件 ·",
							" ",
							data.topics.subscriptions.filter((link) => link.threadId === thread_0.id).length,
							" ",
							"个订阅"
						]
					})
				]
			}, thread_0.id);
			$[39] = data.topics.subscriptions;
			$[40] = data.topics.triggers;
			$[41] = openThread;
			$[42] = t16;
		} else t16 = $[42];
		t4 = topics.map(t16);
		$[0] = data.topics.subscriptions;
		$[1] = data.topics.threads;
		$[2] = data.topics.triggers;
		$[3] = kind;
		$[4] = openThread;
		$[5] = query;
		$[6] = triage;
		$[7] = t0;
		$[8] = t1;
		$[9] = t2;
		$[10] = t3;
		$[11] = t4;
		$[12] = topics;
	} else {
		t0 = $[7];
		t1 = $[8];
		t2 = $[9];
		t3 = $[10];
		t4 = $[11];
		topics = $[12];
	}
	let t5;
	if ($[43] !== data.topics.threads.length || $[44] !== topics) {
		t5 = !data.topics.threads.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚未登记来源话题。请检查已启用项目的 GitHub 环境与采集状态。" }) : !topics.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "没有匹配话题，来源记录仍保留。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			onClick: () => {
				setQuery("");
				setKind("");
				setTriage("");
			},
			children: "清除筛选"
		})] });
		$[43] = data.topics.threads.length;
		$[44] = topics;
		$[45] = t5;
	} else t5 = $[45];
	let t6;
	if ($[46] !== t0 || $[47] !== t1 || $[48] !== t2 || $[49] !== t3 || $[50] !== t4 || $[51] !== t5) {
		t6 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: t0,
			children: [
				t1,
				t2,
				t3,
				t4,
				t5
			]
		});
		$[46] = t0;
		$[47] = t1;
		$[48] = t2;
		$[49] = t3;
		$[50] = t4;
		$[51] = t5;
		$[52] = t6;
	} else t6 = $[52];
	return t6;
}
function _temp2$1(value) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
		value,
		children: value
	}, value);
}
function _temp$1(kind_0) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
		value: kind_0,
		children: kind_0
	}, kind_0);
}
// src/client/store/index.ts
const TABS = [
	{
		kind: "overview",
		label: "tabOverview"
	},
	{
		kind: "ticket",
		label: "tabTickets"
	},
	{
		kind: "trigger",
		label: "tabTriggers"
	},
	{
		kind: "channel",
		label: "tabChannels"
	},
	{
		kind: "setting",
		label: "tabSettings"
	}
];
function tabOf(page) {
	return page.split("/")[0];
}
const store = (0, _deepseek_ai_dsh_client_store.defineStore)({
	init: () => ({
		navigation: {
			page: "overview",
			ticketId: null,
			returnTo: "ticket"
		},
		channel: { selected: null },
		trigger: { selectedId: null },
		filters: {
			project: "",
			status: "",
			query: ""
		},
		graph: {
			zoom: 1,
			x: 0,
			y: 0,
			selectedId: null
		},
		model: null,
		read: {
			state: "loading",
			error: ""
		}
	}),
	actions: {
		go: (draft, page) => {
			draft.navigation.page = page;
		},
		openChannel: (draft, id) => {
			draft.channel.selected = id;
			draft.navigation.page = "channel/detail";
		},
		openTicket: (draft, id) => {
			if (draft.navigation.page !== "ticket/detail") draft.navigation.returnTo = draft.navigation.page;
			draft.navigation.ticketId = id;
			draft.navigation.page = "ticket/detail";
		},
		openThread: (draft, id) => {
			draft.trigger.selectedId = id;
			draft.navigation.page = "trigger/detail";
		},
		filter: (draft, patch) => {
			Object.assign(draft.filters, patch);
		},
		beginRead: (draft) => {
			draft.read = {
				state: "loading",
				error: ""
			};
		},
		receive: (draft, model) => {
			draft.model = model;
			draft.read = {
				state: "ready",
				error: ""
			};
		},
		failRead: (draft, error) => {
			draft.read = {
				state: "error",
				error
			};
		},
		zoomGraph: (draft, delta) => {
			draft.graph.zoom = Math.max(.5, Math.min(2, draft.graph.zoom + delta));
		},
		panGraph: (draft, x, y) => {
			draft.graph.x += x;
			draft.graph.y += y;
		},
		resetGraph: (draft) => {
			draft.graph.zoom = 1;
			draft.graph.x = 0;
			draft.graph.y = 0;
		},
		selectAgent: (draft, id) => {
			draft.graph.selectedId = id;
		}
	}
});
// src/client/panel.tsx
function Panel() {
	const $ = (0, import_dist.c)(79);
	const { t } = useTranslation();
	const page = usePage();
	const navigate = useNavigate();
	const actions = useActions();
	const read = useStore(_temp);
	const model = useStore(_temp2);
	const ctx = useDshContext();
	const sequence = (0, react.useRef)(0);
	let t0;
	if ($[0] !== actions) {
		t0 = async () => {
			const generation = sequence.current = sequence.current + 1;
			actions.beginRead();
			try {
				const model_0 = await nexus.read();
				if (generation === sequence.current) actions.receive(model_0);
				return model_0;
			} catch (t1) {
				const error = t1;
				if (generation === sequence.current) actions.failRead(error instanceof Error ? error.message : String(error));
				throw error;
			}
		};
		$[0] = actions;
		$[1] = t0;
	} else t0 = $[1];
	let t1;
	if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
		t1 = { resetOnExecute: false };
		$[2] = t1;
	} else t1 = $[2];
	const resource = useAsyncState(t0, null, t1);
	let t2;
	if ($[3] !== ctx || $[4] !== resource) {
		t2 = () => {
			const dispose = ctx.on("connection/reset", () => {
				resource.executeImmediate();
			});
			return () => {
				dispose();
			};
		};
		$[3] = ctx;
		$[4] = resource;
		$[5] = t2;
	} else t2 = $[5];
	let t3;
	if ($[6] !== ctx || $[7] !== resource.executeImmediate) {
		t3 = [ctx, resource.executeImmediate];
		$[6] = ctx;
		$[7] = resource.executeImmediate;
		$[8] = t3;
	} else t3 = $[8];
	(0, react.useEffect)(t2, t3);
	let t4;
	if ($[9] !== resource) {
		t4 = async () => {
			await resource.executeImmediate();
		};
		$[9] = resource;
		$[10] = t4;
	} else t4 = $[10];
	const refresh = t4;
	useEventListener("online", refresh);
	useEventListener("focus", refresh);
	let t5;
	if ($[11] !== read.state || $[12] !== refresh || $[13] !== resource.isLoading) {
		t5 = () => {
			if (document.visibilityState === "visible" && read.state === "ready" && !resource.isLoading) refresh();
		};
		$[11] = read.state;
		$[12] = refresh;
		$[13] = resource.isLoading;
		$[14] = t5;
	} else t5 = $[14];
	useIntervalFn(t5, 15e3);
	const t6 = (0, react.useId)();
	let t7;
	if ($[15] !== t6) {
		t7 = t6.replaceAll(":", "");
		$[15] = t6;
		$[16] = t7;
	} else t7 = $[16];
	const tabsId = t7;
	let t8;
	if ($[17] !== t || $[18] !== tabsId) {
		t8 = TABS.map((tab) => ({
			value: tab.kind,
			label: t(tab.label),
			id: `${tabsId}-${tab.kind}`,
			panelId: `${tabsId}-${tab.kind}-panel`
		}));
		$[17] = t;
		$[18] = tabsId;
		$[19] = t8;
	} else t8 = $[19];
	const items = t8;
	let t9;
	if ($[20] !== page) {
		t9 = tabOf(page);
		$[20] = page;
		$[21] = t9;
	} else t9 = $[21];
	const tab_0 = t9;
	let t10;
	if ($[22] === Symbol.for("react.memo_cache_sentinel")) {
		t10 = { fontFamily: "var(--dsw-font-family, -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif)" };
		$[22] = t10;
	} else t10 = $[22];
	let t11;
	if ($[23] !== t) {
		t11 = t("title");
		$[23] = t;
		$[24] = t11;
	} else t11 = $[24];
	let t12;
	if ($[25] !== t11) {
		t12 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
			className: "text-xl leading-7 font-semibold",
			children: t11
		});
		$[25] = t11;
		$[26] = t12;
	} else t12 = $[26];
	let t13;
	if ($[27] !== t) {
		t13 = t("desc");
		$[27] = t;
		$[28] = t13;
	} else t13 = $[28];
	let t14;
	if ($[29] !== t13) {
		t14 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mt-1 text-[13px] text-[var(--dsw-alias-label-secondary)]",
			children: t13
		});
		$[29] = t13;
		$[30] = t14;
	} else t14 = $[30];
	let t15;
	if ($[31] !== model) {
		t15 = model && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			role: "status",
			className: "mt-1 text-[var(--dsw-alias-label-secondary)]",
			children: [{
				initializing: "正在恢复运行责任",
				initialization_failed: "运行初始化失败",
				idle: "运行空闲",
				running: "正在执行",
				unavailable: "运行不可用",
				delivery_failed: "投递失败"
			}[model.run.state], model.run.reason ? ` · ${model.run.reason}` : ""]
		});
		$[31] = model;
		$[32] = t15;
	} else t15 = $[32];
	let t16;
	if ($[33] !== t12 || $[34] !== t14 || $[35] !== t15) {
		t16 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
			t12,
			t14,
			t15
		] });
		$[33] = t12;
		$[34] = t14;
		$[35] = t15;
		$[36] = t16;
	} else t16 = $[36];
	let t17;
	if ($[37] !== refresh) {
		t17 = () => void refresh();
		$[37] = refresh;
		$[38] = t17;
	} else t17 = $[38];
	const t18 = resource.isLoading ? "正在与账本对账…" : "刷新服务端状态";
	let t19;
	if ($[39] !== resource.isLoading || $[40] !== t17 || $[41] !== t18) {
		t19 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			variant: "outline",
			size: "sm",
			disabled: resource.isLoading,
			onClick: t17,
			children: t18
		});
		$[39] = resource.isLoading;
		$[40] = t17;
		$[41] = t18;
		$[42] = t19;
	} else t19 = $[42];
	let t20;
	if ($[43] !== t16 || $[44] !== t19) {
		t20 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-4",
			children: [t16, t19]
		});
		$[43] = t16;
		$[44] = t19;
		$[45] = t20;
	} else t20 = $[45];
	let t21;
	if ($[46] !== t) {
		t21 = t("tabsLabel");
		$[46] = t;
		$[47] = t21;
	} else t21 = $[47];
	let t22;
	if ($[48] !== items || $[49] !== navigate || $[50] !== t21 || $[51] !== tab_0) {
		t22 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "w-full min-w-0 overflow-x-auto",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedTabs, {
				size: "sm",
				items,
				value: tab_0,
				onChange: navigate,
				label: t21,
				className: "w-fit"
			})
		});
		$[48] = items;
		$[49] = navigate;
		$[50] = t21;
		$[51] = tab_0;
		$[52] = t22;
	} else t22 = $[52];
	let t23;
	if ($[53] !== t20 || $[54] !== t22) {
		t23 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "flex w-full min-w-0 max-w-[1080px] flex-none flex-col gap-5 pt-7",
			children: [t20, t22]
		});
		$[53] = t20;
		$[54] = t22;
		$[55] = t23;
	} else t23 = $[55];
	const t24 = `${tabsId}-${tab_0}-panel`;
	const t25 = `${tabsId}-${tab_0}`;
	let t26;
	if ($[56] !== model || $[57] !== read.error || $[58] !== read.state || $[59] !== refresh) {
		t26 = read.state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "rounded-xl border border-[var(--dsw-alias-border-l2)] p-4 text-[var(--dsw-alias-state-error-primary)]",
			children: [
				"读取 Nexus 账本失败：",
				read.error,
				"。",
				model ? "下方为上次读取结果，答复控件已锁定。" : "尚未取得数据，不代表没有待办。",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void refresh(),
					children: "重新读取"
				})
			]
		});
		$[56] = model;
		$[57] = read.error;
		$[58] = read.state;
		$[59] = refresh;
		$[60] = t26;
	} else t26 = $[60];
	let t27;
	if ($[61] !== model || $[62] !== read.state) {
		t27 = !model && read.state === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "status",
			children: "正在读取项目、信箱与运行事实；超过 15 秒将显示读取失败，可重试。"
		});
		$[61] = model;
		$[62] = read.state;
		$[63] = t27;
	} else t27 = $[63];
	let t28;
	if ($[64] !== model || $[65] !== page) {
		t28 = model && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			page === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Overview, {}),
			page === "ticket" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ticket, {}),
			page === "ticket/detail" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TicketDetail, {}),
			page === "trigger" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Trigger, {}),
			page === "trigger/detail" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TriggerDetail, {}),
			page === "channel" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Channel, {}),
			page === "channel/detail" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChannelDetail, {}),
			page === "setting" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Setting, {})
		] });
		$[64] = model;
		$[65] = page;
		$[66] = t28;
	} else t28 = $[66];
	let t29;
	if ($[67] !== t24 || $[68] !== t25 || $[69] !== t26 || $[70] !== t27 || $[71] !== t28) {
		t29 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			id: t24,
			role: "tabpanel",
			"aria-labelledby": t25,
			className: "mt-6 flex w-full min-w-0 max-w-[1080px] flex-none flex-col gap-6 pb-10",
			children: [
				t26,
				t27,
				t28
			]
		});
		$[67] = t24;
		$[68] = t25;
		$[69] = t26;
		$[70] = t27;
		$[71] = t28;
		$[72] = t29;
	} else t29 = $[72];
	let t30;
	if ($[73] !== t23 || $[74] !== t29) {
		t30 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "box-border flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-center overflow-y-auto px-[clamp(20px,4vw,48px)] text-[13px] leading-5 text-[var(--dsw-alias-label-primary)] [&_*]:box-border",
			style: t10,
			children: [t23, t29]
		});
		$[73] = t23;
		$[74] = t29;
		$[75] = t30;
	} else t30 = $[75];
	let t31;
	if ($[76] !== refresh || $[77] !== t30) {
		t31 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshContext.Provider, {
			value: refresh,
			children: t30
		});
		$[76] = refresh;
		$[77] = t30;
		$[78] = t31;
	} else t31 = $[78];
	return t31;
}
function _temp2(state_0) {
	return state_0.model;
}
function _temp(state) {
	return state.read;
}
// src/client/index.tsx
const inject = [
	"slots",
	"locale",
	"sessions",
	"uiWorkspace"
];
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, dicts), `${NS}: dictionaries`);
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
		name: "conversation.input.dock",
		id: "nexus-mailbox",
		order: 10,
		locale: NS
	}, Mailbox));
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: PANEL_ID,
		locale: NS,
		store
	}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginContext.Provider, {
		value: {
			ctx,
			t: props.t,
			useStore: props.useStore,
			actions: props.actions
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {})
	})));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: PANEL_ID,
		order: 10,
		label: () => t("panel"),
		locale: NS
	}, ({ size }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NexusIcon, {
		width: size,
		height: size
	})));
}
exports.apply = apply;
exports.inject = inject;

return module.exports;}});
//# sourceMappingURL=client.cjs.map
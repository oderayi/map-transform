/* eslint-disable security/detect-object-injection */
import mapAny from 'map-any-cjs'
import modify from './modify.js'
import {
  getStateValue,
  setStateValue,
  getTargetFromState,
  setTargetOnState,
  getLastContext,
  getRootFromState,
  isNonvalue,
  revFromState,
  clearUntouched,
} from '../utils/stateHelpers.js'
import { isObject } from '../utils/is.js'
import { ensureArray, indexOfIfArray } from '../utils/array.js'
import type {
  Path,
  Operation,
  State,
  StateMapper,
  DataMapperWithState,
  Options,
} from '../types.js'

const adjustIsSet = (isSet: boolean, state: State) => revFromState(state, isSet) // `isSet` will work as `flip` here

function flatMapAny(fn: (value: unknown, target?: unknown) => unknown) {
  return (value: unknown, target?: unknown) =>
    Array.isArray(value)
      ? value.flatMap((value) => fn(value, target))
      : fn(value, target)
}

function handleArrayPath(path: string): [string | number, boolean, boolean] {
  if (path.endsWith('][')) {
    // This is an index notation
    return [path.slice(0, path.length - 2), false, true /* isIndexProp */]
  }
  const pos = path.indexOf('[')
  if (path[pos - 1] === '\\') {
    // We have an escaped [, return the path with the backslash removed
    return [path.replace('\\[', '['), false, false]
  } else {
    // This is an array notation if the next char is ]
    const isArr = path[pos + 1] === ']'
    return [path.slice(0, pos), isArr, false]
  }
}

// Get rid of some special characters in the path and return the clean path and
// some flags to indicate if we're dealing with an array or index notation
function preparePath(
  path: string | number,
): [string | number, boolean, boolean] {
  if (typeof path === 'string') {
    if (path.includes('[')) {
      // We have an array notation
      return handleArrayPath(path)
    } else if (path.startsWith('\\$')) {
      // This is an escaped $, remove the backslash and return the path with $
      return [path.slice(1), false, false]
    }
  }

  // We have just a plain path
  return [path, false, false]
}

function getSetProp(path: string) {
  if (path === '') {
    // We have an empty path, return the value as is
    return (value: unknown) => value
  }

  const getFn = flatMapAny((value) =>
    isObject(value) ? value[path] : undefined,
  )
  const setFn = (value: unknown, target?: unknown) =>
    isObject(target) ? { ...target, [path]: value } : { [path]: value }

  return (value: unknown, isSet: boolean, target?: unknown) => {
    if (isSet) {
      return setFn(value, target)
    } else {
      return getFn(value)
    }
  }
}

const calculateIndex = (index: number, arr: unknown[]) =>
  index >= 0 ? index : arr.length + index

function getSetIndex(index: number) {
  return (value: unknown, isSet: boolean, target?: unknown) => {
    if (isSet) {
      const arr = Array.isArray(target) ? [...target] : []
      arr[calculateIndex(index, arr)] = value
      return arr
    } else {
      return Array.isArray(value)
        ? value[calculateIndex(index, value)]
        : undefined
    }
  }
}

function getParent(state: State) {
  const nextValue = getLastContext(state)
  const nextContext = state.context.slice(0, -1)
  return { ...state, context: nextContext, value: nextValue }
}

function getRoot(state: State) {
  const nextValue = getRootFromState(state)
  return { ...state, context: [], value: nextValue }
}

function getSetParentOrRoot(path: string, isSet: boolean): Operation {
  const getFn = path[1] === '^' ? getRoot : getParent
  return () => (next) => async (state) => {
    const nextState = await next(state)
    if (adjustIsSet(isSet, state)) {
      // Simple return target instead of setting anything
      return setStateValue(nextState, state.target)
    } else {
      // Get root or parent
      return getFn(nextState)
    }
  }
}

const modifyOnSet =
  (isSet: boolean): Operation =>
  (options) =>
    function modifyOnSet(next) {
      const modifyFn = modify('.')(options)(next)
      return async (state) => {
        return adjustIsSet(isSet, state)
          ? await modifyFn(state) // Modify when we're setting
          : setStateValue(await next(state), undefined) // Return undefined value when we're getting
      }
    }

function doModifyGetValue(value: unknown, state: State, options: Options) {
  const { modifyGetValue } = options
  return typeof modifyGetValue === 'function'
    ? modifyGetValue(value, state, options)
    : value
}

function getSet(isSet = false) {
  return (path: string | number): Operation => {
    if (typeof path === 'string') {
      if (path === '$modify') {
        return modifyOnSet(isSet)
      } else if (path[0] === '^') {
        return getSetParentOrRoot(path, isSet)
      }
    }

    const [basePath, isArr, isIndexProp] = preparePath(path)
    const isIndex = typeof basePath === 'number'
    const getSetFn = isIndex ? getSetIndex(basePath) : getSetProp(basePath)

    return (options) => (next) =>
      async function doGetSet(state) {
        if (adjustIsSet(isSet, state)) {
          // Set
          // We'll go backwards first. Start by preparing target for the next set
          const target = getTargetFromState(state)
          const nextTarget = getSetFn(target, false)

          // Invoke the "previous" path part with the right target, iterate if array
          const nextState = await next(
            setTargetOnState(
              { ...state, iterate: state.iterate || isArr },
              nextTarget,
            ),
          )

          // Now it's our turn. Set the state value - and iterate if necessary
          const setIt = (value: unknown, index?: number) =>
            getSetFn(value, true, indexOfIfArray(target, index))

          const nextValue = getStateValue(nextState)
          if (state.noDefaults && isNonvalue(nextValue, options.nonvalues)) {
            return setStateValue(state, target)
          }
          const value = isArr
            ? ensureArray(nextValue, options.nonvalues)
            : nextValue

          const thisValue =
            nextState.iterate && !isArr && !isIndexProp
              ? mapAny(setIt, value)
              : setIt(value)

          // Return the value
          return setStateValue(state, thisValue)
        } else {
          // Get
          // Go backwards
          const nextState = await next(state)
          const thisValue = getSetFn(getStateValue(nextState), false)
          const modifiedValue = doModifyGetValue(thisValue, nextState, options)

          const value =
            state.noDefaults && isNonvalue(modifiedValue, options.nonvalues)
              ? undefined
              : isArr
              ? ensureArray(modifiedValue, options.nonvalues)
              : modifiedValue

          return setStateValue(
            nextState,
            value,
            true, // Push to context
          )
        }
      }
  }
}

function resolveArrayNotation(path: string, pos: number) {
  const index = Number.parseInt(path.slice(pos + 1), 10)
  if (!Number.isNaN(index)) {
    const basePath = path.slice(0, pos).trim()
    return basePath ? [`${basePath}][`, index] : [index] // `][` is our crazy notation for an index prop
  } else {
    return path.trim()
  }
}

function resolveParentNotation(path: string) {
  if (path.startsWith('^^') && path.length > 2) {
    return ['^^', path.slice(2).trim()]
  } else if (path.length > 1 && path !== '^^') {
    return ['^^', path.slice(1).trim()]
  } else {
    return path.trim()
  }
}

function splitUpArrayAndParentNotation(path: string) {
  const pos = path.indexOf('[')
  if (pos > -1 && path[pos - 1] !== '\\') {
    return resolveArrayNotation(path, pos)
  } else if (path.startsWith('^')) {
    return resolveParentNotation(path)
  } else {
    return path.trim()
  }
}

// Prepare a get or set path, depending on isSet. It's essentially the same,
// only with reversed order and setting or getting by default. When ran in
// reverse mode, it will run the other way.
function pathToNextOperations(path: Path, isSet = false): Operation[] {
  if (!path || path === '.') {
    return [
      () => (next: StateMapper) => async (state: State) =>
        clearUntouched(await next(state)), // We don't change the value, but we still need to clear untouched
    ]
  }

  // Treat as a set if it starts with >
  if (path[0] === '>') {
    path = path.slice(1)
    isSet = true
  }

  // Split the path into parts, and get the operations for each part
  const parts = path.split('.').flatMap(splitUpArrayAndParentNotation)
  const operations = parts.map(getSet(isSet))

  // Reverse order when we're setting
  if (isSet) {
    operations.reverse()
  }

  return operations
}

const getByPart =
  (part: string | number, isArr: boolean) => (value: unknown) => {
    if (typeof part === 'string') {
      if (isObject(value)) {
        const nextValue = value[part]
        return isArr ? ensureArray(nextValue) : nextValue
      }
    } else if (typeof part === 'number' && Array.isArray(value)) {
      return value[calculateIndex(part, value)]
    }
    return isArr ? [] : undefined
  }

function prepareGetFn([part, isArr]: [string | number, boolean, boolean]): (
  value: unknown,
  state: State,
) => [unknown, State | undefined] {
  if (typeof part === 'string' && part[0] === '^') {
    // This part is a parent or a root, so we'll return the value and the next state
    const isRoot = part[1] === '^'
    return (_value, state) => {
      const nextState = isRoot ? getRoot(state) : getParent(state)
      return [nextState.value, nextState]
    }
  } else if (typeof part === 'number') {
    // This is an index part
    const fn = getByPart(part, isArr)
    return (value) => [fn(value), undefined]
  } else {
    // This is a regular part
    const fn = flatMapAny(getByPart(part, isArr))
    return (value) => [fn(value), undefined]
  }
}

const setOnObject = (part: string) => (value: unknown) =>
  part ? { [part]: value } : value

const setByPart =
  (part: string | number, isArr: boolean, doIterate: boolean) =>
  (value: unknown) => {
    const data = isArr ? ensureArray(value) : value
    if (typeof part === 'number') {
      const arr = []
      const index = part < 0 ? 0 : part // Negative index will always be 0
      arr[index] = data
      return arr
    } else {
      return doIterate
        ? mapAny(setOnObject(part), data)
        : setOnObject(part)(data)
    }
  }

function getDoIterateFromLastPart(
  parts: [string | number, boolean, boolean][],
) {
  if (parts.length === 0) {
    return false
  }

  const lastPart = parts[parts.length - 1]
  return lastPart[1] || lastPart[2]
}

const setDoIterateOnParts = (
  parts: [string | number, boolean, boolean][],
  [part, isArr]: [string | number, boolean, boolean],
): [string | number, boolean, boolean][] => [
  ...parts,
  [part, isArr, isArr ? false : getDoIterateFromLastPart(parts)],
]

/**
 * Get a value at the given path.
 */
export function pathGetter(
  path?: string | null,
  _options: Options = {},
): DataMapperWithState {
  if (!path || path === '.') {
    return (value) => value
  }

  const parts = path
    .split('.')
    .flatMap(splitUpArrayAndParentNotation)
    .map(preparePath)
    .map(prepareGetFn)

  return function getFromPath(value, startState) {
    let data = value
    let state = startState
    for (const partOrGetFn of parts) {
      ;[data, state = state] = partOrGetFn(data, state)
    }
    return data
  }
}

/**
 * Set a value to the given path.
 */
export function pathSetter(
  path?: string | null,
  options: Options = {},
): DataMapperWithState {
  if (typeof path !== 'string' || path === '' || path === '.') {
    return (value) => value // Just return the value
  } else if (path[0] === '^') {
    return () => undefined // We won't set on parent or root
  }

  const setFns = path
    .split('.')
    .flatMap(splitUpArrayAndParentNotation)
    .map(preparePath)
    .reduce(setDoIterateOnParts, [])
    .map(([part, isArr, doIterate]) => setByPart(part, isArr, doIterate))

  return function setToPath(value, state) {
    if (state.noDefaults && isNonvalue(value, options.nonvalues)) {
      // We should not set a nonvalue, and this is a nonvalue, so return `undefined`
      return undefined
    } else {
      // Set on path by running the parts in reverse order (from the innermost to the outermost)
      return setFns.reduceRight((value, setFn) => setFn(value), value)
    }
  }
}

/**
 * Run a get path.
 */
export const get = (path: Path) => pathToNextOperations(path, false)

/**
 * Run a set path.
 */
export const set = (path: Path) => pathToNextOperations(path, true)

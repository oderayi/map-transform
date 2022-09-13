import {
  MapDefinition,
  MapTransform,
  State,
  StateMapper,
  Options,
} from './types'
import { operationFromDef } from './utils/definitionHelpers'
import { populateState, getStateValue } from './utils/stateHelpers'
import functions from './functions'
import iterate from './operations/iterate'
import { identity } from './utils/functional'

export { get, set } from './operations/getSet'
export { default as root } from './operations/root'
export { default as alt } from './operations/alt'
export { default as apply } from './operations/apply'
export { default as value } from './operations/value'
export { default as fixed } from './operations/fixed'
export { default as concat } from './operations/concat'
export { default as validate } from './functions/validate'
export { default as not } from './functions/not'
export { default as plug } from './operations/plug'
export { default as lookup } from './operations/lookup'
export { default as transform } from './operations/transform'
export { default as filter } from './operations/filter'
export { default as ifelse } from './operations/ifelse'
export { fwd, rev, divide } from './operations/directionals'
export { default as merge } from './operations/merge'
export { default as modify } from './operations/modify'
export { iterate, functions }
export {
  CustomFunction,
  DataMapper,
  MapDefinition,
  MapObject,
  MapPipe,
  MapTransform,
  Dictionary,
  Dictionaries,
  OperationObject,
  TransformObject,
  FilterObject,
  ApplyObject,
  AltObject,
} from './types'
export { default as pathGetter } from './utils/pathGetter'
export { default as pathSetter } from './utils/pathSetter'

const composeMapFunction = (
  mapFn: StateMapper,
  initialState: Partial<State>
) => {
  const createState = populateState(initialState)

  return (data: unknown) =>
    data === undefined ? undefined : getStateValue(mapFn(createState(data)))
}

const mergeOptions = (options: Options) => ({
  ...options,
  functions: {
    ...functions,
    ...(options.functions || {}),
  },
})

export function mapTransform(
  def: MapDefinition,
  options: Options = {}
): MapTransform {
  const completeOptions = mergeOptions(options)
  const mapFn = operationFromDef(def)(completeOptions)(identity)

  return Object.assign(composeMapFunction(mapFn, {}), {
    onlyMappedValues: composeMapFunction(mapFn, { onlyMapped: true }),
    rev: Object.assign(composeMapFunction(mapFn, { rev: true }), {
      onlyMappedValues: composeMapFunction(mapFn, {
        rev: true,
        onlyMapped: true,
      }),
    }),
  })
}

export default mapTransform

import * as R from 'ramda'
import * as mapAny from 'map-any'
import { Definition, Data } from '..'
import { lensPath } from './lensPath'
import { createFieldMapper, FieldMapperFunction } from './createFieldMapper'
import { pipeTransform, pipeTransformRev } from './transformPipeline'
import { pipeFilter, FilterFunction } from './filterPipeline'
import { normalizeMapping } from './normalizeMapping'

interface BaseMapperFunction {
  (data: Data | null): Data | null
}

export interface MapperFunction extends BaseMapperFunction {
  rev?: BaseMapperFunction
}

export interface MapperFunctionWithRev extends BaseMapperFunction {
  rev: BaseMapperFunction
}

type ISingleMapper = (data: Data) => Data

const _ = (R as any).__

const filterObj = (filterFn: FilterFunction, x: any) =>
  (filterFn(x)) ? x : null

const filterAny = (filterFn: FilterFunction) => (x: any) =>
  (x && typeof x.filter === 'function') ? x.filter(filterFn) : filterObj(filterFn, x)

// [(a -> a -> a)] -> g a
const pipeMapperFns = (mapperFns: FieldMapperFunction[]): ISingleMapper =>
  (data) => mapperFns.reduce((target, fn) => fn(target, data), {})

// Lens -> (a -> a)
const setAtObjectPath = (lens: R.Lens): MapperFunction => R.set(lens, _, {}) as MapperFunction

// Lens -> (a -> a)
const getFromObjectPath = (lens: R.Lens): MapperFunction => R.view(lens)

const mapFieldsOrPassObject = (isRev: boolean) => R.ifElse(
  R.isEmpty,
  R.always([R.nthArg(1)]),
  R.map(R.applyTo(isRev))
)

const createObjectMapper = R.compose(
  pipeMapperFns,
  mapFieldsOrPassObject(false)
)

const createRevObjectMapper = R.compose(
  pipeMapperFns,
  R.reverse as (arr: FieldMapperFunction[]) => FieldMapperFunction[],
  mapFieldsOrPassObject(true)
)

export const createMapper = (def: Definition): MapperFunctionWithRev => {
  const { mapping, pathRev, pathToRev, transform } = def
  const pathLens = lensPath(def.path)
  const pathToLens = lensPath(def.pathTo)
  const pathRevLens = (typeof pathRev !== 'undefined') ? lensPath(pathRev) : pathLens
  const pathToRevLens = (typeof pathToRev !== 'undefined') ? lensPath(pathToRev) : pathToLens

  const fieldMappers = (mapping) ? normalizeMapping(mapping).map(createFieldMapper) : []
  const objectMapper = createObjectMapper(fieldMappers)
  const revObjectMapper = createRevObjectMapper(fieldMappers)
  const transformFn = pipeTransform(transform)
  const transformRevFn = pipeTransformRev(def.transformRev, transform)
  const filterFn = pipeFilter(def.filter)

  const mapper = R.compose(
    setAtObjectPath(pathToLens),
    filterAny(filterFn),
    mapAny(R.compose(transformFn, objectMapper)),
    getFromObjectPath(pathLens)
  )

  const revMapper = R.compose(
    setAtObjectPath(pathRevLens),
    mapAny(R.compose(revObjectMapper, transformRevFn)),
    filterAny(filterFn),
    getFromObjectPath(pathToRevLens)
  )

  return Object.assign(mapper, { rev: revMapper })
}

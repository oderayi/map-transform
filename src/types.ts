export interface ObjectWithProps {
  [key: string]: Data
}

export type Prop = string | number | boolean | object | null | undefined | ObjectWithProps

export type Data = Prop | Prop[]

export type Path = string

export interface Operands {
  [key: string]: any
}

export interface Context {
  rev: boolean,
  onlyMappedValues: boolean
}

export interface DataMapper<U = Data, V = Data> {
  (data: U, context: Context): V
}

export interface CustomFunction<T = Operands, U = Data, V = Data> {
  (operands: T): DataMapper<U, V>
}

export interface CustomFunctions {
  [key: string]: CustomFunction
}

export interface State {
  root: Data,
  context: Data,
  value: Data,
  rev?: boolean,
  onlyMapped?: boolean,
  arr?: boolean
}

export interface Options {
  customFunctions?: CustomFunctions
}

export interface OperationObject extends Operands {
  $op: string,
  $fn?: string
}

export interface StateMapper {
  (state: State): State
}

export interface Operation {
  (options: Options): StateMapper
}

export interface MapFunction {
  (options: Options): (state: State) => State
}

type MapPipeSimple = (MapObject | Operation | OperationObject | Path)[]

export type MapPipe = (MapObject | Operation | OperationObject | Path | MapPipeSimple)[]

export interface MapObject {
  [key: string]: MapDefinition
}

export type MapDefinition = MapObject | Operation | OperationObject | MapPipe | Path | null

export interface MapTransformWithOnlyMappedValues {
  (data: Data): Data
  onlyMappedValues: (data: Data) => Data
}

export interface MapTransform extends MapTransformWithOnlyMappedValues {
  rev: MapTransformWithOnlyMappedValues
}

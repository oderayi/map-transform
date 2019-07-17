import test from 'ava'
import { set } from './getSet'

import merge from './merge'

// Setup

const data = [
  {
    heading: 'Entry 1',
    createdBy: 'johnf',
    tags: ['popular', 'news']
  },
  {
    heading: 'Entry 2',
    createdBy: 'lucyk',
    tags: ['tech']
  }
]

const stateWithObject = {
  root: data[0],
  context: data[0],
  value: data[0]
}

const stateWithArray = {
  root: data,
  context: data,
  value: data
}

const options = {}

// Tests

test('should run pipelines and merge the result', t => {
  const pipelines = [
    ['heading', set('title')],
    ['createdBy', set('author')],
    ['tags', set('sections[]')]
  ]
  const expectedValue = {
    title: 'Entry 1',
    author: 'johnf',
    sections: ['popular', 'news']
  }

  const ret = merge(...pipelines)(options)(stateWithObject)

  t.deepEqual(ret.value, expectedValue)
})

test('should run pipelines and merge the result with several levels', t => {
  const pipelines = [
    ['heading', set('content.title')],
    ['createdBy', set('meta.author')],
    ['tags', set('meta.sections[]')]
  ]
  const expectedValue = {
    content: { title: 'Entry 1' },
    meta: {
      author: 'johnf',
      sections: ['popular', 'news']
    }
  }

  const ret = merge(...pipelines)(options)(stateWithObject)

  t.deepEqual(ret.value, expectedValue)
})

test('should run pipelines and merge arrays', t => {
  const pipelines = [
    ['heading', set('title')],
    ['createdBy', set('author')]
  ]
  const expectedValue = [
    {
      title: 'Entry 1',
      author: 'johnf'
    },
    {
      title: 'Entry 2',
      author: 'lucyk'
    }
  ]

  const ret = merge(...pipelines)(options)(stateWithArray)

  t.deepEqual(ret.value, expectedValue)
})

test('should run one pipeline', t => {
  const pipelines = [
    ['heading', set('title')]
  ]
  const expectedValue = {
    title: 'Entry 1'
  }

  const ret = merge(...pipelines)(options)(stateWithObject)

  t.deepEqual(ret.value, expectedValue)
})

test('should run no pipeline', t => {
  const pipelines = [] as string[][]
  const expectedValue = undefined

  const ret = merge(...pipelines)(options)(stateWithObject)

  t.deepEqual(ret.value, expectedValue)
})

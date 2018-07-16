import test from 'ava'
import { TransformFunction } from '../utils/transformPipeline'

import mapTransform = require('..')

// Helpers

const appendEllipsis: TransformFunction = (str: string) => str + ' ...'
appendEllipsis.rev = (str: string) =>
  (str.endsWith(' ...')) ? str.substr(0, str.length - 4) : str
const upperCase: TransformFunction = (str: string) => str.toUpperCase()
const getLength: TransformFunction = (str: string) => str.length
const enclose: TransformFunction = (str: string) => `(${str})`
enclose.rev = (str: string) => (str.startsWith('(') && str.endsWith(')'))
  ? str.substr(1, str.length - 2) : str

// Tests

test('should map field with one transform function', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: appendEllipsis
      }
    }
  }
  const data = {
    content: { heading: 'The heading' }
  }
  const expected = {
    title: 'The heading ...'
  }

  const ret = mapTransform(mapping)(data)

  t.deepEqual(ret, expected)
})

test('should map field with array of transform functions', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: [ appendEllipsis, upperCase ]
      }
    }
  }
  const data = {
    content: { heading: 'The heading' }
  }
  const expected = {
    title: 'THE HEADING ...'
  }

  const ret = mapTransform(mapping)(data)

  t.deepEqual(ret, expected)
})

test('should apply transform functions from left to right', (t) => {
  const mapping = {
    fields: {
      titleLength: {
        path: 'content.heading',
        transform: [ appendEllipsis, getLength ]
      }
    }
  }
  const data = {
    content: { heading: 'The heading' }
  }
  const expected = {
    titleLength: 15
  }

  const ret = mapTransform(mapping)(data)

  t.deepEqual(ret, expected)
})

test('should not fail with empty transform array', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: []
      }
    }
  }
  const data = {
    content: { heading: 'The heading' }
  }
  const expected = {
    title: 'The heading'
  }

  const ret = mapTransform(mapping)(data)

  t.deepEqual(ret, expected)
})

test('should reverse map with transform functions from transformRev', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: [ upperCase ],
        transformRev: [ getLength, appendEllipsis ]
      }
    }
  }
  const data = {
    title: 'The heading'
  }
  const expected = {
    content: { heading: '11 ...' }
  }

  const ret = mapTransform(mapping).rev(data)

  t.deepEqual(ret, expected)
})

test('should reverse map with transform function from rev props', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: appendEllipsis
      }
    }
  }
  const data = {
    title: 'The heading ...'
  }
  const expected = {
    content: { heading: 'The heading' }
  }

  const ret = mapTransform(mapping).rev(data)

  t.deepEqual(ret, expected)
})

test('should reverse map with several transform functions from rev props', (t) => {
  const mapping = {
    fields: {
      title: {
        path: 'content.heading',
        transform: [ appendEllipsis, upperCase, enclose ]
      }
    }
  }
  const data = {
    title: '(The heading ...)'
  }
  const expected = {
    content: { heading: 'The heading' }
  }

  const ret = mapTransform(mapping).rev(data)

  t.deepEqual(ret, expected)
})

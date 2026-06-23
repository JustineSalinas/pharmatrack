import { describe, it, expect } from 'vitest'
import {
  parseCommaList,
  parseLineList,
  formatPriceLabel,
  mapRowToMerchItem,
  toProductRecord,
  type ProductRow,
} from '../merch'

describe('parseCommaList', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseCommaList('S, M,  L,')).toEqual(['S', 'M', 'L'])
  })

  it('returns an empty array for blank input', () => {
    expect(parseCommaList('   ')).toEqual([])
  })
})

describe('parseLineList', () => {
  it('splits on newlines, trims, and drops empty lines', () => {
    expect(parseLineList('Feature one\n  Feature two  \n\nFeature three')).toEqual([
      'Feature one',
      'Feature two',
      'Feature three',
    ])
  })
})

describe('formatPriceLabel', () => {
  it('prefixes a bare number with PHP', () => {
    expect(formatPriceLabel('599.00')).toBe('PHP 599.00')
  })

  it('leaves an already-prefixed value alone', () => {
    expect(formatPriceLabel('PHP 1,299.00')).toBe('PHP 1,299.00')
  })

  it('is case-insensitive when checking for an existing prefix', () => {
    expect(formatPriceLabel('php 120.00')).toBe('php 120.00')
  })

  it('defaults blank input to PHP 0.00', () => {
    expect(formatPriceLabel('   ')).toBe('PHP 0.00')
  })
})

describe('mapRowToMerchItem', () => {
  const baseRow: ProductRow = {
    id: 'abc-123',
    name: 'Pharmacy Tote',
    category: 'accessories',
    price_label: 'PHP 350.00',
    description: 'A tote.',
    status: 'Showcase Only',
    material: 'Canvas',
    sizes: null,
    colors: ['White'],
    features: ['Zippered top'],
    images: ['https://example.com/tote.png'],
  }

  it('maps a fully-populated row to a MerchItem', () => {
    const item = mapRowToMerchItem(baseRow)
    expect(item).toEqual({
      id: 'abc-123',
      name: 'Pharmacy Tote',
      category: 'accessories',
      pricePlaceholder: 'PHP 350.00',
      image: 'https://example.com/tote.png',
      images: ['https://example.com/tote.png'],
      description: 'A tote.',
      status: 'Showcase Only',
      details: {
        material: 'Canvas',
        sizes: undefined,
        colors: ['White'],
        features: ['Zippered top'],
      },
    })
  })

  it('falls back to placeholder text/colors/features when null', () => {
    const item = mapRowToMerchItem({
      ...baseRow,
      description: null,
      material: null,
      colors: null,
      features: null,
    })
    expect(item.description).toBe('No description provided.')
    expect(item.details.material).toBe('N/A')
    expect(item.details.colors).toEqual(['N/A'])
    expect(item.details.features).toEqual(['N/A'])
  })

  it('falls back to a default image when images is empty', () => {
    const item = mapRowToMerchItem({ ...baseRow, images: [] })
    expect(item.image).toBe('/merch/shirt.png')
  })
})

describe('toProductRecord', () => {
  it('builds a DB-shaped record from a form draft', () => {
    const record = toProductRecord({
      name: 'Pharmacy Cap',
      category: 'apparel',
      pricePlaceholder: '250',
      description: '',
      status: 'Coming Soon',
      material: '',
      sizes: [],
      colors: [],
      features: [],
      images: [],
    })
    expect(record).toEqual({
      name: 'Pharmacy Cap',
      category: 'apparel',
      price_label: 'PHP 250',
      description: 'No description provided.',
      status: 'Coming Soon',
      material: 'N/A',
      sizes: null,
      colors: ['N/A'],
      features: ['N/A'],
      images: ['/merch/shirt.png'],
    })
  })

  it('preserves provided sizes, colors, features, and images', () => {
    const record = toProductRecord({
      name: 'Pharmacy Cap',
      category: 'apparel',
      pricePlaceholder: 'PHP 250.00',
      description: 'A cap.',
      status: 'Showcase Only',
      material: 'Cotton',
      sizes: ['S', 'M'],
      colors: ['Green'],
      features: ['Adjustable strap'],
      images: ['https://example.com/cap.png'],
    })
    expect(record.sizes).toEqual(['S', 'M'])
    expect(record.colors).toEqual(['Green'])
    expect(record.features).toEqual(['Adjustable strap'])
    expect(record.images).toEqual(['https://example.com/cap.png'])
  })
})

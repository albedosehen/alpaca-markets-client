import { describe, it } from '@std/testing/bdd'
import { assertEquals, assertThrows } from '@std/assert'
import { AlpacaMarketValidationError } from '../../errors/errors.ts'
import { validateFieldName, validateQueryValue } from '../../validators/validatorHelpers.ts'

describe('Custom Validation Framework', () => {
  describe('Field Name Validation', () => {
    it('should accept valid field names', () => {
      const result = validateFieldName('valid_field_name')
      assertEquals(result.success, true)
    })

    it('should reject empty strings', () => {
      const result = validateFieldName('')
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('empty'), true)
    })

    it('should reject SQL injection patterns', () => {
      const result = validateFieldName("'; DROP TABLE users; --")
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('SQL'), true)
    })

    it('should reject invalid characters', () => {
      const result = validateFieldName('field-with-hyphens')
      assertEquals(result.success, false)
    })
  })

  describe('Query Value Validation', () => {
    it('should accept primitive values', () => {
      assertEquals(validateQueryValue('string').success, true)
      assertEquals(validateQueryValue(123).success, true)
      assertEquals(validateQueryValue(true).success, true)
      assertEquals(validateQueryValue(null).success, true)
      assertEquals(validateQueryValue(undefined).success, true)
    })

    it('should accept valid arrays', () => {
      const result = validateQueryValue(['item1', 'item2', 123])
      assertEquals(result.success, true)
    })

    it('should reject functions', () => {
      const result = validateQueryValue(() => 'test')
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('Function'), true)
    })

    it('should reject oversized arrays', () => {
      const largeArray = new Array(1001).fill('item')
      const result = validateQueryValue(largeArray)
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('1000'), true)
    })

    it('should validate nested objects recursively', () => {
      const validObject = {
        valid_field: 'value',
        nested: {
          also_valid: 123,
        },
      }
      const result = validateQueryValue(validObject)
      assertEquals(result.success, true)
    })

    it('should reject objects with invalid field names', () => {
      const invalidObject = {
        'invalid-field': 'value',
      }
      const result = validateQueryValue(invalidObject)
      assertEquals(result.success, false)
    })

    it('should reject objects with too many properties', () => {
      const largeObject: Record<string, string> = {}
      for (let i = 0; i < 101; i++) {
        largeObject[`field_${i}`] = 'value'
      }
      const result = validateQueryValue(largeObject)
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('100'), true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should provide detailed error context', () => {
      const result = validateFieldName(123)
      assertEquals(result.success, false)
      assertEquals(result.context?.field, 'field name')
      assertEquals(typeof result.error, 'string')
    })

    it('should handle deeply nested validation errors', () => {
      const nestedObject = {
        level1: {
          level2: {
            level3: {
              'invalid-field': 'value',
            },
          },
        },
      }
      const result = validateQueryValue(nestedObject)
      assertEquals(result.success, false)
      assertEquals(result.error?.includes('invalid'), true)
    })

    it('should handle circular references gracefully', () => {
      // deno-lint-ignore no-explicit-any
      const circular: any = { valid_field: 'value' }
      circular.self = circular

      // The validator should handle this gracefully without infinite recursion
      const result = validateQueryValue(circular)
      // It should either succeed (by handling the recursion) or fail with a clear error
      assertEquals(typeof result.success, 'boolean')
      if (!result.success) {
        assertEquals(typeof result.error, 'string')
      }
    })
  })

  describe('Performance and Scale', () => {
    it('should handle moderate-sized valid data efficiently', () => {
      const moderateArray = new Array(100).fill('item')
      const moderateObject: Record<string, unknown> = {}
      for (let i = 0; i < 50; i++) {
        moderateObject[`field_${i}`] = `value_${i}`
      }

      const startTime = Date.now()

      const arrayResult = validateQueryValue(moderateArray)
      const objectResult = validateQueryValue(moderateObject)

      const duration = Date.now() - startTime

      assertEquals(arrayResult.success, true)
      assertEquals(objectResult.success, true)
      assertEquals(duration < 100, true) // Should complete in <100ms
    })
  })

  describe('Integration with AlpacaError', () => {
    it('should integrate properly with AlpacaMarketValidationError', () => {
      assertThrows(() => {
        const result = validateFieldName('')
        if (!result.success) {
          throw new AlpacaMarketValidationError(result.error!, result.context)
        }
      }, AlpacaMarketValidationError)
    })
  })
})

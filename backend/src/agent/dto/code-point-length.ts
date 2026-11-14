import { ValidateBy, type ValidationOptions } from 'class-validator';

export function codePointLength(value: string): number {
  return [...value].length;
}

export function CodePointLength(
  min: number,
  max: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'codePointLength',
      constraints: [min, max],
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string') return false;
          const length = codePointLength(value);
          return length >= min && length <= max;
        },
        defaultMessage: () =>
          `$property deve ter entre ${min} e ${max} caracteres (code points).`,
      },
    },
    options,
  );
}

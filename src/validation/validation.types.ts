export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  sceneId?: string;
  objectId?: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function createValidationResult(
  issues: ValidationIssue[],
): ValidationResult {
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

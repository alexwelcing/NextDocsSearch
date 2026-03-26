/**
 * ProGen Quality Validator
 * 
 * Validates generated characters for anatomical correctness,
 * aesthetic quality, and uniqueness.
 */

import {
  ProGenCharacter, QualityReport, QualityScore, QualityIssue,
  BodyProportions, FaceFeatures
} from '../types';

export class QualityValidator {
  private characterHistory: Map<string, ProGenCharacter> = new Map();
  private similarityThreshold = 0.85;
  
  /**
   * Validate a character and generate a quality report
   */
  validate(character: ProGenCharacter): QualityReport {
    const issues: QualityIssue[] = [];
    
    // Check proportions
    const proportionIssues = this.validateProportions(character);
    issues.push(...proportionIssues);
    
    // Check aesthetics
    const aestheticIssues = this.validateAesthetics(character);
    issues.push(...aestheticIssues);
    
    // Check technical validity
    const technicalIssues = this.validateTechnical(character);
    issues.push(...technicalIssues);
    
    // Check uniqueness against history
    const uniquenessIssues = this.validateUniqueness(character);
    issues.push(...uniquenessIssues);
    
    // Calculate adjusted scores based on issues
    const scores = this.adjustScores(character.generation.quality, issues);
    
    // Determine if character passes
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const passed = criticalCount === 0 && scores.overall >= 70;
    
    const report: QualityReport = {
      characterId: character.identity.id,
      scores,
      issues,
      passed,
      reviewedAt: new Date()
    };
    
    // Store in history if it passed
    if (passed) {
      this.characterHistory.set(character.identity.id, character);
    }
    
    return report;
  }
  
  /**
   * Validate anatomical proportions
   */
  private validateProportions(character: ProGenCharacter): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const p = character.body.proportions;
    
    // Check height is within human range
    if (p.height < 1.4 || p.height > 2.2) {
      issues.push({
        type: 'proportion',
        severity: p.height < 1.3 || p.height > 2.3 ? 'critical' : 'warning',
        message: `Height ${p.height.toFixed(2)}m is outside normal human range`,
        component: 'height'
      });
    }
    
    // Check leg-to-torso ratio
    const torsoLength = p.height - p.legLength;
    const legTorsoRatio = p.legLength / torsoLength;
    if (legTorsoRatio < 0.8 || legTorsoRatio > 1.4) {
      issues.push({
        type: 'proportion',
        severity: legTorsoRatio < 0.7 || legTorsoRatio > 1.5 ? 'warning' : 'info',
        message: `Leg-to-torso ratio ${legTorsoRatio.toFixed(2)} is unusual`,
        component: 'leg_ratio'
      });
    }
    
    // Check arm length (should reach mid-thigh)
    const expectedArmLength = torsoLength * 0.8;
    const armRatio = p.armLength / expectedArmLength;
    if (armRatio < 0.85 || armRatio > 1.15) {
      issues.push({
        type: 'proportion',
        severity: armRatio < 0.7 || armRatio > 1.3 ? 'warning' : 'info',
        message: `Arm length proportion ${armRatio.toFixed(2)} is unusual`,
        component: 'arm_length'
      });
    }
    
    // Check head-to-body ratio
    const headToBody = (p.headScale * 0.25) / p.height;
    if (headToBody < 0.06 || headToBody > 0.14) {
      issues.push({
        type: 'proportion',
        severity: headToBody < 0.05 || headToBody > 0.16 ? 'warning' : 'info',
        message: `Head-to-body ratio ${headToBody.toFixed(3)} is outside typical range`,
        component: 'head_scale'
      });
    }
    
    // Check shoulder-to-hip ratio
    const shoulderHipRatio = p.shoulderWidth / p.hipWidth;
    if (shoulderHipRatio < 0.8 || shoulderHipRatio > 1.6) {
      issues.push({
        type: 'proportion',
        severity: 'info',
        message: `Shoulder-to-hip ratio ${shoulderHipRatio.toFixed(2)} creates distinctive silhouette`,
        component: 'shoulder_hip_ratio'
      });
    }
    
    return issues;
  }
  
  /**
   * Validate aesthetic quality
   */
  private validateAesthetics(character: ProGenCharacter): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const colors = character.colors;
    
    // Check color contrast (simplified luminance check)
    const primaryLum = this.getLuminance(colors.primary);
    const secondaryLum = this.getLuminance(colors.secondary);
    const contrast = Math.abs(primaryLum - secondaryLum);
    
    if (contrast < 0.1) {
      issues.push({
        type: 'aesthetic',
        severity: 'info',
        message: 'Low contrast between primary and secondary colors',
        component: 'color_contrast'
      });
    }
    
    // Check for overly saturated combinations
    if (this.isOverlySaturated(colors.primary) && this.isOverlySaturated(colors.secondary)) {
      issues.push({
        type: 'aesthetic',
        severity: 'warning',
        message: 'Highly saturated color combination may cause visual fatigue',
        component: 'color_saturation'
      });
    }
    
    // Check outfit layering coherence
    const outfit = character.outfit;
    const totalBulk = outfit.reduce((sum, layer) => sum + layer.bulk, 0);
    if (totalBulk > 0.8) {
      issues.push({
        type: 'aesthetic',
        severity: 'info',
        message: 'High outfit bulk may restrict movement visually',
        component: 'outfit_bulk'
      });
    }
    
    // Check face feature coherence
    const face = character.face;
    if (face.eyeSpacing < 0.45 || face.eyeSpacing > 0.65) {
      issues.push({
        type: 'aesthetic',
        severity: face.eyeSpacing < 0.4 || face.eyeSpacing > 0.7 ? 'warning' : 'info',
        message: 'Unusual eye spacing may affect facial aesthetics',
        component: 'eye_spacing'
      });
    }
    
    return issues;
  }
  
  /**
   * Validate technical correctness
   */
  private validateTechnical(character: ProGenCharacter): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    // Check skeleton integrity
    const skeleton = character.skeleton;
    const boneNames = new Set(skeleton.hierarchy.map(b => b.name));
    
    // Verify all bones have valid parents
    for (const bone of skeleton.hierarchy) {
      if (bone.parent && !boneNames.has(bone.parent)) {
        issues.push({
          type: 'technical',
          severity: 'critical',
          message: `Bone "${bone.name}" references non-existent parent "${bone.parent}"`,
          component: 'skeleton'
        });
      }
    }
    
    // Check for root bone
    const rootBones = skeleton.hierarchy.filter(b => !b.parent);
    if (rootBones.length !== 1) {
      issues.push({
        type: 'technical',
        severity: 'critical',
        message: `Skeleton should have exactly one root bone, found ${rootBones.length}`,
        component: 'skeleton'
      });
    }
    
    // Check for negative/zero bone lengths
    const invalidBones = skeleton.hierarchy.filter(b => b.length <= 0);
    if (invalidBones.length > 0) {
      issues.push({
        type: 'technical',
        severity: 'critical',
        message: `${invalidBones.length} bones have invalid lengths`,
        component: 'skeleton'
      });
    }
    
    // Check animation validity
    for (const [state, anim] of Object.entries(character.animations)) {
      if (anim.keyframes.length < 2) {
        issues.push({
          type: 'technical',
          severity: 'warning',
          message: `Animation "${state}" has fewer than 2 keyframes`,
          component: 'animation'
        });
      }
      
      // Check keyframe times are monotonically increasing
      for (let i = 1; i < anim.keyframes.length; i++) {
        if (anim.keyframes[i].time <= anim.keyframes[i - 1].time) {
          issues.push({
            type: 'technical',
            severity: 'warning',
            message: `Animation "${state}" has non-monotonic keyframe times`,
            component: 'animation'
          });
          break;
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Validate uniqueness against character history
   */
  private validateUniqueness(character: ProGenCharacter): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    if (this.characterHistory.size === 0) {
      return issues;
    }
    
    // Calculate similarity to all existing characters
    let maxSimilarity = 0;
    let mostSimilarId = '';
    
    for (const [id, existing] of Array.from(this.characterHistory.entries())) {
      const similarity = this.calculateSimilarity(character, existing);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarId = id;
      }
    }
    
    if (maxSimilarity > this.similarityThreshold) {
      issues.push({
        type: 'duplicate',
        severity: maxSimilarity > 0.95 ? 'warning' : 'info',
        message: `Character is ${(maxSimilarity * 100).toFixed(1)}% similar to existing character "${mostSimilarId}"`,
        component: 'uniqueness'
      });
    }
    
    return issues;
  }
  
  /**
   * Calculate similarity between two characters
   */
  private calculateSimilarity(a: ProGenCharacter, b: ProGenCharacter): number {
    let score = 0;
    let weights = 0;
    
    // Compare body proportions (weight: 3)
    const propA = Object.values(a.body.proportions);
    const propB = Object.values(b.body.proportions);
    const propDiff = propA.reduce((sum, val, i) => sum + Math.abs(val - propB[i]), 0) / propA.length;
    score += (1 - propDiff) * 3;
    weights += 3;
    
    // Compare colors (weight: 2)
    const colorDist = this.colorDistance(a.colors, b.colors);
    score += (1 - colorDist) * 2;
    weights += 2;
    
    // Compare archetype (weight: 2)
    if (a.identity.archetype === b.identity.archetype) {
      score += 2;
    }
    weights += 2;
    
    // Compare face features (weight: 2)
    const faceA = Object.values(a.face);
    const faceB = Object.values(b.face);
    const faceDiff = faceA.reduce((sum, val, i) => sum + Math.abs(val - faceB[i]), 0) / faceA.length;
    score += (1 - faceDiff) * 2;
    weights += 2;
    
    // Compare build (weight: 1)
    if (a.body.build === b.body.build) {
      score += 1;
    }
    weights += 1;
    
    return score / weights;
  }
  
  /**
   * Calculate color distance between two palettes
   */
  private colorDistance(a: ProGenCharacter['colors'], b: ProGenCharacter['colors']): number {
    const colorsA = [a.primary, a.secondary, a.tertiary];
    const colorsB = [b.primary, b.secondary, b.tertiary];
    
    let totalDist = 0;
    for (let i = 0; i < 3; i++) {
      const rgbA = this.hexToRgb(colorsA[i]);
      const rgbB = this.hexToRgb(colorsB[i]);
      const dist = Math.sqrt(
        Math.pow(rgbA.r - rgbB.r, 2) +
        Math.pow(rgbA.g - rgbB.g, 2) +
        Math.pow(rgbA.b - rgbB.b, 2)
      ) / 441.67; // Normalize by max possible distance
      totalDist += dist;
    }
    
    return Math.min(1, totalDist / 3);
  }
  
  /**
   * Adjust quality scores based on issues found
   */
  private adjustScores(base: QualityScore, issues: QualityIssue[]): QualityScore {
    let proportionPenalty = 0;
    let aestheticPenalty = 0;
    let technicalPenalty = 0;
    let uniquenessPenalty = 0;
    
    for (const issue of issues) {
      const penalty = issue.severity === 'critical' ? 15 : issue.severity === 'warning' ? 5 : 2;
      
      switch (issue.type) {
        case 'proportion':
          proportionPenalty += penalty;
          break;
        case 'aesthetic':
          aestheticPenalty += penalty;
          break;
        case 'technical':
          technicalPenalty += penalty;
          break;
        case 'duplicate':
          uniquenessPenalty += penalty;
          break;
      }
    }
    
    const proportions = Math.max(0, base.proportions - proportionPenalty);
    const aesthetics = Math.max(0, base.aesthetics - aestheticPenalty);
    const technical = Math.max(0, base.technical - technicalPenalty);
    const uniqueness = Math.max(0, base.uniqueness - uniquenessPenalty);
    
    const overall = Math.round(
      (proportions * 0.3) +
      (aesthetics * 0.3) +
      (technical * 0.2) +
      (uniqueness * 0.2)
    );
    
    return { overall, proportions, aesthetics, technical, uniqueness };
  }
  
  /**
   * Get luminance of a hex color (0-1)
   */
  private getLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  }
  
  /**
   * Check if a color is overly saturated
   */
  private isOverlySaturated(hex: string): boolean {
    const rgb = this.hexToRgb(hex);
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return saturation > 0.85;
  }
  
  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  /**
   * Get validation statistics
   */
  getStats(): {
    totalValidated: number;
    passRate: number;
    averageQuality: number;
    issueCounts: Record<string, number>;
  } {
    const reports = Array.from(this.characterHistory.values()).map(c => ({
      passed: true,
      score: c.generation.quality.overall
    }));
    
    const total = this.characterHistory.size;
    const passed = reports.length;
    const avgQuality = reports.reduce((sum, r) => sum + r.score, 0) / total;
    
    return {
      totalValidated: total,
      passRate: total > 0 ? passed / total : 0,
      averageQuality: avgQuality,
      issueCounts: {}
    };
  }
  
  /**
   * Clear character history
   */
  clearHistory(): void {
    this.characterHistory.clear();
  }
}

export default QualityValidator;

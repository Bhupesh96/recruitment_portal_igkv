import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  constructor() {}
  calculateScore(
    methodId: number,
    data: any,
    parentMaxValue: number
  ): {
    score_field_value: number;
    score_field_actual_value: number;
    score_field_calculated_value: number;
    details?: any[];
  } {
    switch (methodId) {
      case 1: // Marks based (Education)
        return this.calculateEducationScore(data.educations, parentMaxValue);
      case 2: // Calculation based (Experience)
        return this.calculateTotalExperience(data.experiences, parentMaxValue);
      case 3: // Quantity based
        return this.calculateQuantityBasedScore(
          data.quantityInputs,
          parentMaxValue
        );
      default:
        return {
          score_field_value: 0,
          score_field_actual_value: 0,
          score_field_calculated_value: 0,
        };
    }
  }
  // Experience Calculation Method
  calculateDuration(
    fromDate: Date,
    toDate: Date,
    fieldWeightage: number = 1,
    returnType: 'rawDuration' | 'decimalYears' | 'days' = 'decimalYears'
  ): any {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const msInDay = 1000 * 60 * 60 * 24;
    const durationInDays = Math.round(
      (end.getTime() - start.getTime()) / msInDay
    );
    const decimalYears = durationInDays / 365.25;

    if (returnType === 'days') {
      return Math.round(durationInDays * fieldWeightage);
    }

    if (returnType === 'decimalYears') {
      return +(decimalYears * fieldWeightage).toFixed(4);
    }

    const years = Math.floor(durationInDays / 365);
    const months = Math.floor((durationInDays % 365) / 30);
    const days = (durationInDays % 365) % 30;

    return { years, months, days };
  }

  calculateTotalExperience(
    experiences: {
      from: Date;
      to: Date;
      weight: number;
      toMaxvalue: number; // no longer used in logic
    }[],
    parentWeightage: number
  ): {
    score_field_value: number;
    score_field_actual_value: number;
    score_field_calculated_value: number;
    details?: {
      from: string;
      to: string;
      Score_field_value: number;
      Score_field_actual_value: number;
      Score_field_calculated_value: number;
    }[];
  } {
    let totalDays = 0;
    const details = [];

    for (const exp of experiences) {
      const days = this.calculateDuration(exp.from, exp.to, exp.weight, 'days');
      const actualYears = +(days / 365.25).toFixed(4);
      const finalvalue =
        actualYears > exp.toMaxvalue ? exp.toMaxvalue : actualYears;

      totalDays += days;

      details.push({
        from: this.formatDate(exp.from),
        to: this.formatDate(exp.to),
        Score_field_value: days,
        Score_field_actual_value: actualYears,
        Score_field_calculated_value: finalvalue,
      });
    }

    const totalDecimalYears = +(totalDays / 365.25).toFixed(4);
    const isParentWeightageValid = totalDecimalYears <= parentWeightage;
    const finalParentValue = isParentWeightageValid
      ? totalDecimalYears
      : parentWeightage;

    return {
      score_field_value: totalDays,
      score_field_actual_value: totalDecimalYears,
      score_field_calculated_value: finalParentValue,
      details,
    };
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }

  // Education Calculatiion Marks Calculation Method
  calculateEducationScoreOLd(
    educations: {
      weight: number; // weightage of the field
      inputValue: number; // marks/percentage
    }[],
    parentFieldMarks: number // max marks from parent field
  ): {
    total_actual_value: number;
    score_field_calculated_value: number;
    details: {
      weight: number;
      inputValue: number;
      score_field_actual_value: number;
    }[];
  } {
    let total_actual_value = 0;
    const details = educations.map((edu) => {
      const score_field_actual_value = +(
        edu.weight *
        (edu.inputValue / 10)
      ).toFixed(4);
      total_actual_value += score_field_actual_value;
      return {
        weight: edu.weight,
        inputValue: edu.inputValue,
        score_field_actual_value,
      };
    });

    const score_field_calculated_value =
      total_actual_value <= parentFieldMarks
        ? +total_actual_value.toFixed(4)
        : +parentFieldMarks.toFixed(4);

    return {
      total_actual_value: +total_actual_value.toFixed(4),
      score_field_calculated_value,
      details,
    };
  }

  calculateEducationScore(
    educations: {
      scoreFieldId: number;
      weight: number;
      inputValue: number;
      maxValue?: number;
    }[],
    parentFieldMarks: number
  ): {
    score_field_value: number;
    score_field_actual_value: number;
    score_field_calculated_value: number;
    details?: {
      scoreFieldId: number;
      weight: number;
      inputValue: number;
      score_field_actual_value: number;
      score_field_calculated_value: number;
    }[];
  } {
    let total_actual_value = 0;
    let total_calculated_value = 0;

    const details = educations.map((edu) => {
      const actual_value = +((edu.inputValue * edu.weight) / 10).toFixed(4);
      const calculated_value =
        edu.maxValue !== undefined
          ? Math.min(actual_value, edu.maxValue)
          : actual_value;

      total_actual_value += actual_value;
      total_calculated_value += calculated_value;

      return {
        scoreFieldId: edu.scoreFieldId,
        weight: edu.weight,
        inputValue: edu.inputValue,
        score_field_actual_value: actual_value,
        score_field_calculated_value: +calculated_value.toFixed(4),
      };
    });

    const score_field_calculated_value =
      total_calculated_value <= parentFieldMarks
        ? +total_calculated_value.toFixed(4)
        : +parentFieldMarks.toFixed(4);

    return {
      score_field_value: +total_actual_value.toFixed(4),
      score_field_actual_value: +total_actual_value.toFixed(4),
      score_field_calculated_value,
      details,
    };
  }
  // Corrected calculateQuantityBasedScore in UtilsService
  calculateQuantityBasedScore(
    quantityScoreInput: {
      scoreFieldId: number;
      quantity: number;
      weightage: number;
      scoreFieldMarks: number;
    }[],
    parentScoreFieldMarks: number
  ): {
    score_field_value: number; // Sum of quantities
    score_field_actual_value: number; // Sum of uncapped calculated marks
    score_field_calculated_value: number; // Sum of capped final marks, then capped at parent level
    details?: any[];
  } {
    let totalCalculatedMarks = 0; // Sum of quantity * weightage (uncapped)
    let totalFinalMarks = 0; // Sum of capped item marks

    const details = quantityScoreInput.map((input) => {
      const calculatedMarks = +(input.quantity * input.weightage).toFixed(2);
      const finalMarks = Math.min(calculatedMarks, input.scoreFieldMarks);

      totalCalculatedMarks += calculatedMarks;
      totalFinalMarks += finalMarks;

      return {
        scoreFieldId: input.scoreFieldId,
        quantity: input.quantity,
        weightage: input.weightage,
        scoreFieldMarks: input.scoreFieldMarks,
        calculatedMarks,
        finalMarks,
      };
    });

    const cappedFinal = Math.min(totalFinalMarks, parentScoreFieldMarks);

    // Return the correct values as per your expected output
    return {
      score_field_value: quantityScoreInput.reduce(
        (sum, item) => sum + item.quantity,
        0
      ), // Sum of all quantities
      score_field_actual_value: +totalCalculatedMarks.toFixed(2),
      score_field_calculated_value: +cappedFinal.toFixed(2),
      details,
    };
  }
}

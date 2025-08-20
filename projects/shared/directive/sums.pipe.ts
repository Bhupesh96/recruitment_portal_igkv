import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'sums'
})
export class SumsPipe implements PipeTransform {

  transform(items: any[], attr: string): number {
    return items.reduce((sum, item) => sum + item[attr], 0);
  }

}

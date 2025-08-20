import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'tableFilter'
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], searchText: string, key?: string): any[] {
    if (!items) return [];
    if (!searchText) return items;

    searchText = searchText.toLowerCase();

    return items.filter(item => {
      if (key) {
        // If key is defined, search in that specific key
        return item[key] && item[key].toString().toLowerCase().includes(searchText);
      } else {
        // If no key is provided, search in all keys of the object
        return Object.values(item).some(value =>
          value && value.toString().toLowerCase().includes(searchText)
        );
      }
    });
  }
}

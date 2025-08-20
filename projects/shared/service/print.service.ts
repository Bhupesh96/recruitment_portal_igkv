import {Injectable} from '@angular/core';
import {environment} from "../../environments/environment.dev";

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  constructor() {
  }
  async printHTML(htmlContent: string): Promise<any> {
    const cssResponse = await fetch(environment.printCSS);
    const cssContent = await cssResponse.text();
    return new Promise<void>((resolve: any, reject: any): any => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        reject(new Error('Print window could not be opened.'));
        return;
      }
      printWindow?.document.open();
      printWindow?.document.write(`
            <html lang="en">
            <head>
            <title>Print tab</title>
             <style>
            ${cssContent} /* Injected CSS content */
          </style>
            <script>
                document.addEventListener("DOMContentLoaded", function() {
                   setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                          window.close();
                        }, 100); // Close window after 0.5 seconds (500 milliseconds)
                    }, 100);
                });
            </script>
            </head>
            <body>
               ${htmlContent}
                </body>
            </html>`);
      printWindow?.document.close();
      printWindow.addEventListener('load', () => {
        printWindow.onload = () => {
          try {
            printWindow.print();
            resolve(true);
            printWindow.close();
          } catch (error) {
            reject(error);
          }
        };
      });
    })
  }
}

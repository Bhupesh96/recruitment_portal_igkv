import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Import FormsModule

@Component({
  selector: 'app-claim-modal',
  standalone: true,
  imports: [CommonModule, FormsModule], // <-- Add FormsModule
  templateUrl: './claim-modal.component.html',
  styleUrls: ['./claim-modal.component.scss'],
})
export class ClaimModalComponent {
  // Input() receives data *from* the parent
  @Input() itemData: any = null; // The main item (e.g., "10+2")
  @Input() rowData: any = null; // The specific row (with cells and status)

  // Output() sends events *to* the parent
  @Output() submitClaim = new EventEmitter<any>();
  @Output() closeModal = new EventEmitter<void>();

  // Local properties to bind to the form
  public remark: string = '';
  public selectedFile: File | null = null;
  public fileError: string | null = null;

  constructor() {}

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Optional: Add file validation (e.g., size, type)
      if (file.size > 2 * 1024 * 1024) {
        // 2MB limit
        this.fileError = 'File is too large (max 2MB).';
        this.selectedFile = null;
        event.target.value = null; // Clear the input
      } else {
        this.fileError = null;
        this.selectedFile = file;
      }
    }
  }

  onSubmit(): void {
    if (!this.remark || !this.selectedFile) {
      alert('Please provide a remark and upload a file.');
      return;
    }

    // Send all the data back to the parent component
    this.submitClaim.emit({
      remark: this.remark,
      file: this.selectedFile,
      // We also send back the original data for context
      itemData: this.itemData,
      rowData: this.rowData,
    });

    this.resetAndClose();
  }

  onCancel(): void {
    this.closeModal.emit();
    this.resetAndClose();
  }

  private resetAndClose(): void {
    this.remark = '';
    this.selectedFile = null;
    this.fileError = null;
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private pendingCount = 0;

  readonly loading$ = this.loadingSubject.asObservable();

  show(): void {
    this.pendingCount += 1;
    if (this.pendingCount === 1) {
      this.loadingSubject.next(true);
    }
  }

  hide(): void {
    if (this.pendingCount > 0) {
      this.pendingCount -= 1;
    }
    if (this.pendingCount === 0) {
      this.loadingSubject.next(false);
    }
  }
}

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './components/nav.component';
import { ToastOutletComponent } from './components/toast-outlet.component';
import { LoaderComponent } from './components/loader.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavComponent, ToastOutletComponent, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('elearning');
}

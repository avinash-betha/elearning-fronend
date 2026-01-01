import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) return;

    const role = localStorage.getItem('userRole') || 'student';
    if (role === 'admin') {
      this.router.navigate(['/admin']);
      return;
    }
    if (role === 'instructor') {
      this.router.navigate(['/instructor']);
      return;
    }
    this.router.navigate(['/dashboard']);
  }
}

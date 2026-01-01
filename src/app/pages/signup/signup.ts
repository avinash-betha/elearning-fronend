import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  name = '';
  email = '';
  password = '';
  role = 'student';
  errorMessage = '';
  isSubmitting = false;

  constructor(private router: Router, private auth: AuthService) {}

  async onSignup() {
    this.errorMessage = '';
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const requestedRole = this.role === 'instructor' ? 'instructor' : 'student';
      await this.auth.register({
        name: this.name,
        email: this.email,
        password: this.password,
        requestedRole
      });

      const user = await this.auth.login(this.email, this.password);

      if (requestedRole === 'instructor' && user.role !== 'instructor') {
        this.router.navigate(['/apply-instructor']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (e: any) {
      if (e?.status === 0) {
        this.errorMessage = 'Network error. Check backend URL, CORS, and server status.';
      } else if (e?.error?.message) {
        this.errorMessage = e.error.message;
      } else if (typeof e?.error === 'string' && e.error.trim()) {
        this.errorMessage = e.error;
      } else {
        this.errorMessage = e?.message || 'Signup failed. Please try again.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }
}

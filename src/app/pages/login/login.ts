import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  selectedRole = 'student';
  showAdminLogin = false;
  adminPassword = '';
  errorMessage = '';
  infoMessage = '';

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  toggleAdminLogin() {
    this.showAdminLogin = !this.showAdminLogin;
    if (this.showAdminLogin) {
      this.selectedRole = 'admin';
      this.email = '';
      this.password = '';
      this.errorMessage = '';
      this.infoMessage = '';
    } else {
      this.selectedRole = 'student';
      this.errorMessage = '';
      this.infoMessage = '';
    }
  }

  async onLogin() {
    this.errorMessage = '';
    this.infoMessage = '';
    
    if (this.email && this.password) {
      try {
        const user = await this.auth.login(this.email, this.password);

        // If user tries to login as instructor, require approved instructor role
        if (this.selectedRole === 'instructor' && user.role !== 'instructor') {
          await this.auth.logout();
          const status = user.instructorApplicationStatus || 'none';
          if (status === 'pending') {
            this.errorMessage = 'Your instructor application is still under review. Please login as Student for now.';
          } else if (status === 'rejected') {
            this.errorMessage = 'Your instructor application was rejected. You can re-apply from Profile Settings.';
          } else {
            this.errorMessage = 'Your account is not an approved instructor. Apply from Profile Settings.';
          }
          return;
        }

        // Route based on stored role
        if (user.role === 'instructor') {
          this.router.navigate(['/instructor']);
        } else if (user.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } catch (e: any) {
        this.errorMessage = e?.message || 'Login failed. Please try again.';
      }
    }
  }
}

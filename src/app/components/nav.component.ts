import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navigation">
      <div class="nav-content">
        <div class="nav-links">
          <a *ngIf="!isLoggedIn" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a>
          <a routerLink="/courses" routerLinkActive="active">Courses</a>
          
          <ng-container *ngIf="isLoggedIn">
            <a routerLink="/dashboard" routerLinkActive="active" *ngIf="userRole === 'student'">Dashboard</a>
            <a routerLink="/enrolled-courses" routerLinkActive="active" *ngIf="userRole === 'student'">My Courses</a>
            <a routerLink="/cart" routerLinkActive="active" *ngIf="userRole === 'student'">
              <span>Cart</span>
              <span class="badge" *ngIf="cartCount > 0" aria-label="Cart items">{{ cartCount }}</span>
            </a>
            <a routerLink="/instructor" routerLinkActive="active" *ngIf="userRole === 'instructor'">Dashboard</a>
            <a routerLink="/admin" routerLinkActive="active" *ngIf="userRole === 'admin'">Dashboard</a>
            <a routerLink="/support" routerLinkActive="active">Support</a>
            <a routerLink="/profile" routerLinkActive="active">Profile</a>
          </ng-container>
        </div>

        <div class="nav-actions">
          <ng-container *ngIf="!isLoggedIn">
            <a routerLink="/login" class="btn-link">Login</a>
            <a routerLink="/signup" class="btn-signup">Sign Up</a>
          </ng-container>
          
          <ng-container *ngIf="isLoggedIn">
            <div class="user-menu">
              <span class="user-name">
                <img *ngIf="userProfilePhoto" class="user-avatar" [src]="userProfilePhoto" alt="Profile">
                <span *ngIf="!userProfilePhoto" class="material-icons">account_circle</span>
                {{userName}}
              </span>
              <button (click)="logout()" class="btn-logout">
                <span class="material-icons">logout</span>
                Logout
              </button>
            </div>
          </ng-container>
        </div>

        <button class="mobile-menu-btn" (click)="toggleMobileMenu()">
          <span class="material-icons">menu</span>
        </button>
      </div>

      <div class="mobile-menu" [class.show]="showMobileMenu">
        <a *ngIf="!isLoggedIn" routerLink="/" (click)="closeMobileMenu()">Home</a>
        <a routerLink="/courses" (click)="closeMobileMenu()">Courses</a>
        
        <ng-container *ngIf="isLoggedIn">
          <a routerLink="/dashboard" (click)="closeMobileMenu()" *ngIf="userRole === 'student'">Dashboard</a>
          <a routerLink="/enrolled-courses" (click)="closeMobileMenu()" *ngIf="userRole === 'student'">My Courses</a>
          <a routerLink="/cart" (click)="closeMobileMenu()" *ngIf="userRole === 'student'">
            <span>Cart</span>
            <span class="badge" *ngIf="cartCount > 0" aria-label="Cart items">{{ cartCount }}</span>
          </a>
          <a routerLink="/instructor" (click)="closeMobileMenu()" *ngIf="userRole === 'instructor'">Dashboard</a>
          <a routerLink="/admin" (click)="closeMobileMenu()" *ngIf="userRole === 'admin'">Dashboard</a>
          <a routerLink="/support" (click)="closeMobileMenu()">Support</a>
          <a routerLink="/profile" (click)="closeMobileMenu()">Profile</a>
          <div class="mobile-user-info">
            <img *ngIf="userProfilePhoto" class="user-avatar" [src]="userProfilePhoto" alt="Profile">
            <span *ngIf="!userProfilePhoto" class="material-icons">account_circle</span>
            <span>{{userName}}</span>
          </div>
          <button (click)="logout()" class="btn-logout-mobile">
            <span class="material-icons">logout</span>
            Logout
          </button>
        </ng-container>
        
        <ng-container *ngIf="!isLoggedIn">
          <a routerLink="/login" (click)="closeMobileMenu()">Login</a>
          <a routerLink="/signup" (click)="closeMobileMenu()">Sign Up</a>
        </ng-container>
      </div>
    </nav>
  `,
  styles: [`
    .navigation {
      background: white;
      border-bottom: 1px solid #eee;
      padding: 0 32px;
    }

    .nav-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
    }

    .nav-links {
      display: flex;
      gap: 32px;
      align-items: center;
    }

    .nav-links a {
      color: #333;
      text-decoration: none;
      font-weight: 500;
      font-size: 15px;
      transition: color 0.3s ease;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: #1f6a5a;
      color: white;
      font-size: 12px;
      line-height: 20px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .nav-links a:hover {
      color: #1f6a5a;
    }

    .nav-links a.active {
      color: #1f6a5a;
    }

    .nav-links a.active::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(135deg, #1f6a5a 0%, #f2a93b 100%);
    }

    .nav-actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .btn-link {
      color: #1f6a5a;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      transition: color 0.3s ease;
    }

    .btn-link:hover {
      color: #f2a93b;
    }

    .btn-signup {
      padding: 10px 24px;
      background: linear-gradient(135deg, #1f6a5a 0%, #f2a93b 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    .btn-signup:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .user-menu {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .user-name {
      color: #333;
      font-weight: 500;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-avatar {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      object-fit: cover;
      border: 1px solid #e2e8f0;
    }

    .user-name .material-icons {
      font-size: 20px;
      color: #1f6a5a;
    }

    .btn-logout {
      padding: 8px 20px;
      background: white;
      color: #1f6a5a;
      border: 2px solid #1f6a5a;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-logout .material-icons {
      font-size: 18px;
    }

    .btn-logout:hover {
      background: #1f6a5a;
      color: white;
    }

    .mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      font-size: 24px;
      color: #333;
      cursor: pointer;
      padding: 8px;
    }

    .mobile-menu-btn .material-icons {
      font-size: 28px;
    }

    .mobile-menu {
      display: none;
      flex-direction: column;
      background: white;
      border-top: 1px solid #eee;
      padding: 16px;
      gap: 12px;
    }

    .mobile-menu a {
      color: #333;
      text-decoration: none;
      font-weight: 500;
      padding: 12px;
      border-radius: 8px;
      transition: background 0.3s ease;
    }

    .mobile-menu a:hover {
      background: #f8f9ff;
      color: #1f6a5a;
    }

    .mobile-user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      color: #333;
      font-weight: 500;
      border-top: 1px solid #eee;
      margin-top: 8px;
    }

    .mobile-user-info .material-icons {
      color: #1f6a5a;
    }

    .btn-logout-mobile {
      padding: 12px;
      background: white;
      color: #1f6a5a;
      border: 2px solid #1f6a5a;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-logout-mobile .material-icons {
      font-size: 20px;
    }

    .btn-logout-mobile:hover {
      background: #1f6a5a;
      color: white;
    }

    @media (max-width: 768px) {
      .navigation {
        padding: 0 20px;
      }

      .nav-links, .nav-actions {
        display: none;
      }

      .mobile-menu-btn {
        display: block;
      }

      .mobile-menu.show {
        display: flex;
      }
    }
  `]
})
export class NavComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  userName = '';
  userRole = '';
  userProfilePhoto = '';
  userEmail = '';
  cartCount = 0;
  showMobileMenu = false;
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private cart: CartService
  ) {}

  ngOnInit() {
    this.checkLoginStatus();
    
    // Subscribe to router events to check login status after navigation
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkLoginStatus();
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  checkLoginStatus() {
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (this.isLoggedIn) {
      this.userName = localStorage.getItem('userName') || 'User';
      this.userRole = localStorage.getItem('userRole') || 'student';
      this.userProfilePhoto = localStorage.getItem('userProfilePhoto') || '';
      this.userEmail = (localStorage.getItem('userEmail') || '').trim().toLowerCase();
    } else {
      this.userName = '';
      this.userRole = '';
      this.userProfilePhoto = '';
      this.userEmail = '';
    }

    void this.refreshCartCount();
  }

  private async refreshCartCount(): Promise<void> {
    const shouldLoad = this.isLoggedIn && this.userRole === 'student' && !!this.userEmail;
    if (!shouldLoad) {
      this.cartCount = 0;
      return;
    }

    try {
      const items = await this.cart.getItems();
      this.cartCount = items.length;
    } catch {
      this.cartCount = 0;
    }
  }

  logout() {
    // Clear all authentication data
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userProfilePhoto');
    
    // Update component state
    this.isLoggedIn = false;
    this.userName = '';
    this.userRole = '';
    this.userProfilePhoto = '';
    this.userEmail = '';
    this.cartCount = 0;
    this.showMobileMenu = false;

    this.cartCount = 0;
    
    // Navigate to home page
    this.router.navigate(['/']);
  }

  toggleMobileMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu() {
    this.showMobileMenu = false;
  }
}


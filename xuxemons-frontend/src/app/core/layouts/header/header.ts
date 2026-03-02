import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../services/auth';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit, OnDestroy {
  user: User | null = null;
  isAdmin = false;
  private sub!: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.sub = this.authService.user$.subscribe(user => {
      this.user = user;
      this.isAdmin = user?.role === 'admin';
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  getUserName(): string {
    return this.user?.id ?? 'Unknown';
  }
}

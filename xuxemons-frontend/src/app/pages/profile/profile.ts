import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth';
import { Breadcrumb } from '../../breadcrumb/breadcrumb';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, Breadcrumb],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  user: User | null = null;
  private sub: { unsubscribe: () => void } | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.sub = this.authService.user$.subscribe(u => (this.user = u));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}

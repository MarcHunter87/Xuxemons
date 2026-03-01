import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface BreadcrumbItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css',
})
export class Breadcrumb implements OnInit, OnDestroy {
  items: BreadcrumbItem[] = [];
  private sub!: Subscription;

  private readonly labels: Record<string, string> = {
    'battle': 'Battle',
    'xuxedex': 'Xuxedex',
    'inventory': 'Inventory',
    'profile': 'Profile',
    'edit': 'Edit Profile',
    'leaderboard': 'Leaderboard',
    'game-rules': 'Game Rules',
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.buildBreadcrumb(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.buildBreadcrumb(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private buildBreadcrumb(url: string): void {
    const segments = url.split('/').filter(s => s);
    if (segments[0] === 'profile') {
      this.items = [{ label: 'Profile', path: '/profile' }];
      let acc = '/profile';
      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        acc += `/${seg}`;
        const label = this.labels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
        this.items.push({ label, path: acc });
      }
    } else {
      this.items = [{ label: 'Home', path: '/' }];
      let acc = '';
      for (const seg of segments) {
        acc += `/${seg}`;
        const label = this.labels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
        this.items.push({ label, path: acc });
      }
    }
  }

  isLast(index: number): boolean {
    return index === this.items.length - 1;
  }
}

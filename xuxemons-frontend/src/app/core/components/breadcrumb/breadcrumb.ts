import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { BreadcrumbItem } from '../../interfaces';

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
    'friends': 'Friends',
    'admin': 'Admin',
    'give-item-form': 'Give Item Form',
    'leaderboard': 'Leaderboard',
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
      if (segments.length === 0) {
        this.items = [{ label: 'Home', path: '/' }];
      } else {
        let acc = '';
        const pathItems: BreadcrumbItem[] = [];
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          acc += `/${seg}`;
          if (seg === 'give-item-form' && i + 1 < segments.length) {
            const rawId = segments[i + 1];
            acc += `/${rawId}`;
            const idForLabel = this.decodeIdForBreadcrumb(rawId);
            pathItems.push({ label: `Give Item ${idForLabel}`, path: acc });
            i++;
          } else {
            const label = this.labels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
            pathItems.push({ label, path: acc });
          }
        }
        this.items = pathItems;
      }
    }
  }

  isLast(index: number): boolean {
    return index === this.items.length - 1;
  }

  private decodeIdForBreadcrumb(raw: string): string {
    let s = raw;
    for (let i = 0; i < 3; i++) {
      try {
        const d = decodeURIComponent(s);
        if (d === s) break;
        s = d;
      } catch {
        break;
      }
    }
    return s;
  }
}

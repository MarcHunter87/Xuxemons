import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './core/layouts/header/header';
import { Footer } from './core/layouts/footer/footer';
import { Breadcrumb } from './core/components/breadcrumb/breadcrumb';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, Breadcrumb],
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  protected readonly showLayout = signal(true);
  protected readonly showTopBreadcrumb = signal(true);
  protected readonly isProfilePage = signal(false);
  private sub: { unsubscribe: () => void } | null = null;

  constructor(private router: Router) {}

  private updateShowLayout(): void {
    const url = this.router.url.split('?')[0];
    this.showLayout.set(url !== '/login' && url !== '/register');
    this.showTopBreadcrumb.set(url !== '/profile');
    this.isProfilePage.set(url === '/profile');
  }

  ngOnInit(): void {
    this.updateShowLayout();
    this.sub = this.router.events.pipe(
      filter(e => e.constructor.name === 'NavigationEnd')
    ).subscribe(() => {
      this.updateShowLayout();
      if (this.showLayout()) {
        setTimeout(() => {
          const b = document.body;
          b.setAttribute('tabindex', '-1');
          b.focus();
          b.removeAttribute('tabindex');
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}

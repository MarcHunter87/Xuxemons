import { Injectable, signal, inject, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';

export interface Xuxemon {
    id: number;
    name: string;
    type: { name: string };
    size: 'Small' | 'Medium' | 'Large';
    image_url: string;
}

@Injectable({
    providedIn: 'root'
})
export class XuxemonService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private apiUrl = isPlatformBrowser(this.platformId) ? 'http://localhost:8080/api' : 'http://backend/api';
    private auth = inject(AuthService);

    public xuxemonsList = signal<Xuxemon[]>([]);
    public myXuxemonsList = signal<Xuxemon[]>([]);

    public typeInventory = signal<string>('all');
    public typeXuxemon = signal<string>('');
    public searchQuery = signal<string>('');

    public displayXuxemons = computed(() => {
        const typeInv = this.typeInventory();
        const typeXuxe = this.typeXuxemon();
        const query = (this.searchQuery() || '').toLowerCase().trim();

        const baseList = typeInv === 'my' ? this.myXuxemonsList() : this.xuxemonsList();

        if (!baseList) return [];

        return baseList.filter(x => {
            const xType = x.type?.name || '';
            const matchesType = !typeXuxe || xType === typeXuxe;
            const matchesQuery = !query || (x.name || '').toLowerCase().includes(query);
            return matchesType && matchesQuery;
        });
    });

    async loadAllXuxemons() {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const raw = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/xuxemons`));
            const data = (raw || []).map(x => ({
                id: x.id,
                name: x.name,
                type: x.type,
                size: x.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${x.icon_path || ''}`)
            })) as Xuxemon[];
            this.xuxemonsList.set(data);
        } catch (error) {
            console.error('Error loading all xuxemons:', error);
            this.xuxemonsList.set([]);
        }
    }

    async loadMyXuxemons() {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const raw = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/xuxemons/me`));
            const data = (raw || []).map(x => ({
                id: x.id,
                name: x.name,
                type: x.type,
                size: x.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${x.icon_path || ''}`)
            })) as Xuxemon[];
            this.myXuxemonsList.set(data);
        } catch (error) {
            console.error('Error loading my xuxemons:', error);
            this.myXuxemonsList.set([]);
        }
    }

    async loadCollectionStats(): Promise<{ acquired: number; total: number } | null> {
        if (!isPlatformBrowser(this.platformId)) return null;
        try {
            const raw = await firstValueFrom(
                this.http.get<{ acquired: number; total: number }>(
                    `${this.apiUrl}/xuxemons/collection-stats`,
                ),
            );
            if (raw && typeof raw.total === 'number' && typeof raw.acquired === 'number') {
                return {
                    acquired: Math.max(0, raw.acquired),
                    total: Math.max(0, raw.total),
                };
            }
        } catch {}
        
        try {
            const [all, mine] = await Promise.all([
                firstValueFrom(this.http.get<unknown[]>(`${this.apiUrl}/xuxemons`)),
                firstValueFrom(this.http.get<unknown[]>(`${this.apiUrl}/xuxemons/me`)),
            ]);
            const mineArr: unknown[] = Array.isArray(mine) ? mine : [];
            const uniqueIds = new Set<number>();
            for (const x of mineArr) {
                if (
                    typeof x === 'object' &&
                    x !== null &&
                    'id' in x &&
                    typeof (x as { id: unknown }).id === 'number'
                ) {
                    uniqueIds.add((x as { id: number }).id);
                }
            }
            return {
                total: Array.isArray(all) ? all.length : 0,
                acquired: uniqueIds.size,
            };
        } catch {
            return null;
        }
    }

    async awardRandomXuxemon() {
        if (!isPlatformBrowser(this.platformId)) return null;
        try {
            const raw = await firstValueFrom(this.http.post<any>(`${this.apiUrl}/xuxemons/award-random`, {}));
            const data: Xuxemon = {
                id: raw?.id,
                name: raw?.name,
                type: raw?.type,
                size: raw?.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${raw?.icon_path || ''}`)
            };
            await this.loadMyXuxemons();
            return data;
        } catch (error) {
            console.error('Error awarding random xuxemon:', error);
            return null;
        }
    }
}

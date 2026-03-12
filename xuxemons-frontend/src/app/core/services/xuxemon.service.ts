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

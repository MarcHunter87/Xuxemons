import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';
import type { Xuxemon } from '../interfaces';

export type { Xuxemon };

@Injectable({
    providedIn: 'root'
})
export class XuxemonService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private apiUrl = isPlatformBrowser(this.platformId) ? 'http://localhost:8080/api' : 'http://backend/api';
    private auth = inject(AuthService);

    private readonly xuxemonsList$ = new BehaviorSubject<Xuxemon[]>([]);
    private readonly myXuxemonsList$ = new BehaviorSubject<Xuxemon[]>([]);
    private readonly typeInventory$ = new BehaviorSubject<string>('all');
    private readonly typeXuxemon$ = new BehaviorSubject<string>('');
    private readonly sizeXuxemon$ = new BehaviorSubject<string>('');
    private readonly searchQuery$ = new BehaviorSubject<string>('');

    readonly xuxemonsList: Observable<Xuxemon[]> = this.xuxemonsList$.asObservable();
    readonly myXuxemonsList: Observable<Xuxemon[]> = this.myXuxemonsList$.asObservable();
    readonly typeInventory: Observable<string> = this.typeInventory$.asObservable();
    readonly typeXuxemon: Observable<string> = this.typeXuxemon$.asObservable();
    readonly sizeXuxemon: Observable<string> = this.sizeXuxemon$.asObservable();
    readonly searchQuery: Observable<string> = this.searchQuery$.asObservable();

    readonly displayXuxemons: Observable<Xuxemon[]> = combineLatest([
        this.xuxemonsList$,
        this.myXuxemonsList$,
        this.typeInventory$,
        this.typeXuxemon$,
        this.sizeXuxemon$,
        this.searchQuery$
    ]).pipe(
        map(([list, myList, typeInv, typeXuxe, sizeXuxe, query]) => {
            const baseList = typeInv === 'my' ? myList : list;
            if (!baseList.length) return [];
            const q = (query || '').toLowerCase().trim();
            return baseList.filter(x => {
                const xType = x.type?.name || '';
                const matchesType = !typeXuxe || xType === typeXuxe;
                const matchesSize = !sizeXuxe || x.size === sizeXuxe;
                const matchesQuery = !q || (x.name || '').toLowerCase().includes(q);
                return matchesType && matchesSize && matchesQuery;
            });
        })
    );

    getXuxemonsList(): Xuxemon[] {
        return this.xuxemonsList$.getValue();
    }

    getMyXuxemonsList(): Xuxemon[] {
        return this.myXuxemonsList$.getValue();
    }

    getDisplayXuxemons(): Xuxemon[] {
        const typeInv = this.typeInventory$.getValue();
        const typeXuxe = this.typeXuxemon$.getValue();
        const sizeXuxe = this.sizeXuxemon$.getValue();
        const query = (this.searchQuery$.getValue() || '').toLowerCase().trim();
        const baseList = typeInv === 'my' ? this.myXuxemonsList$.getValue() : this.xuxemonsList$.getValue();
        if (!baseList.length) return [];
        return baseList.filter(x => {
            const xType = x.type?.name || '';
            const matchesType = !typeXuxe || xType === typeXuxe;
            const matchesSize = !sizeXuxe || x.size === sizeXuxe;
            const matchesQuery = !query || (x.name || '').toLowerCase().includes(query);
            return matchesType && matchesSize && matchesQuery;
        });
    }

    setTypeInventory(value: string): void {
        this.typeInventory$.next(value);
    }

    setTypeXuxemon(value: string): void {
        this.typeXuxemon$.next(value);
    }

    setSizeXuxemon(value: string): void {
        this.sizeXuxemon$.next(value);
    }

    setSearchQuery(value: string): void {
        this.searchQuery$.next(value);
    }

    private mapStatusEffect(status: any): { name: string; icon_url: string } | undefined {
        if (!status?.name || !status?.icon_path) return undefined;
        return {
            name: status.name,
            icon_url: this.auth.getAssetUrl(`/${status.icon_path}`),
        };
    }

    private mapAttacks(x: any): Xuxemon['attacks'] {
        const a1 = x.attack1 ?? x.attack_1;
        const a2 = x.attack2 ?? x.attack_2;
        const xAttack = x.attack ?? 0;
        return [a1, a2].filter(Boolean).map((atk: any) => ({
            id: atk.id,
            name: atk.name,
            description: atk.description,
            dmg: atk.dmg != null ? atk.dmg : xAttack,
            status_chance: atk.status_chance ?? null,
            statusEffect: this.mapStatusEffect(atk.statusEffect ?? atk.status_effect),
        }));
    }

    async loadAllXuxemons(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const type = this.typeXuxemon$.getValue();
            const size = this.sizeXuxemon$.getValue();
            let params = new HttpParams();
            if (type) params = params.set('type', type);
            if (size) params = params.set('size', size);
            const raw = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/xuxemons`, { params }));
            const data = (raw || []).map(x => ({
                id: x.id,
                name: x.name,
                type: x.type,
                size: x.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${x.icon_path || ''}`),
                description: x.description,
                level: x.level,
                hp: x.hp,
                attack: x.attack,
                defense: x.defense,
                attacks: this.mapAttacks(x),
            })) as Xuxemon[];
            this.xuxemonsList$.next(data);
        } catch (error) {
            console.error('Error loading all xuxemons:', error);
            this.xuxemonsList$.next([]);
        }
    }

    async loadMyXuxemons(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const raw = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/xuxemons/me`));
            const data = (raw || []).map(x => ({
                id: x.id,
                name: x.name,
                type: x.type,
                size: x.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${x.icon_path || ''}`),
                statusEffect: this.mapStatusEffect(x.status_effect_applied),
                description: x.description,
                adquired_at: x.adquired_at ?? x.created_at,
                hp: x.hp,
                current_hp: x.current_hp ?? x.hp,
                attack: x.attack,
                defense: x.defense,
                attacks: this.mapAttacks(x),
            })) as Xuxemon[];
            this.myXuxemonsList$.next(data);
        } catch (error) {
            console.error('Error loading my xuxemons:', error);
            this.myXuxemonsList$.next([]);
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

    async awardRandomXuxemon(): Promise<Xuxemon | null> {
        if (!isPlatformBrowser(this.platformId)) return null;
        try {
            const raw = await firstValueFrom(this.http.post<any>(`${this.apiUrl}/xuxemons/award-random`, {}));
            const data: Xuxemon = {
                id: raw?.id,
                name: raw?.name,
                type: raw?.type,
                size: raw?.size ?? 'Small',
                image_url: this.auth.getAssetUrl(`/${raw?.icon_path || ''}`),
                description: raw?.description,
                level: raw?.level,
                hp: raw?.hp,
                attack: raw?.attack,
                defense: raw?.defense,
                attacks: this.mapAttacks(raw ?? {}),
            };
            await this.loadMyXuxemons();
            return data;
        } catch (error) {
            console.error('Error awarding random xuxemon:', error);
            return null;
        }
    }
}

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import type { ApiInventoryItem, InventoryItem, UseItemResponseData } from '../interfaces';
import { AuthService } from './auth';

export type { ApiInventoryItem, InventoryItem };

interface InventoryApiResponse {
    message?: string;
    data: {
        items: ApiInventoryItem[];
        max_slots?: number;
        used_slots?: number;
        available_slots?: number;
        max_capacity?: number;
        capacity?: number;
    };
}

@Injectable({
    providedIn: 'root',
})
export class InventoryService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private auth = inject(AuthService);
    private apiUrl = isPlatformBrowser(this.platformId) ? 'http://localhost:8080/api' : 'http://backend/api';

    private readonly items$ = new BehaviorSubject<InventoryItem[]>([]);
    private readonly filteredItems$ = new BehaviorSubject<InventoryItem[]>([]);
    private readonly selectedItem$ = new BehaviorSubject<InventoryItem | null>(null);
    private readonly isLoading$ = new BehaviorSubject<boolean>(true);
    private readonly errorMessage$ = new BehaviorSubject<string | null>(null);
    private readonly selectedFilter$ = new BehaviorSubject<string>('all');
    private readonly availableEffectTypes$ = new BehaviorSubject<string[]>([]);
    private readonly maxSlotsFromBackend$ = new BehaviorSubject<number>(20);
    private readonly usedSlotsFromBackend$ = new BehaviorSubject<number>(0);
    private readonly maxCapacity$ = new BehaviorSubject<number>(0);
    private readonly discardMode$ = new BehaviorSubject<boolean>(false);
    private readonly discardQuantity$ = new BehaviorSubject<number>(1);
    private readonly discardError$ = new BehaviorSubject<string | null>(null);
    private readonly discardApiError$ = new BehaviorSubject<string | null>(null);
    private readonly isDiscarding$ = new BehaviorSubject<boolean>(false);

    readonly maxSlots = 20;

    readonly items: Observable<InventoryItem[]> = this.items$.asObservable();
    readonly filteredItems: Observable<InventoryItem[]> = this.filteredItems$.asObservable();
    readonly selectedItem: Observable<InventoryItem | null> = this.selectedItem$.asObservable();
    readonly isLoading: Observable<boolean> = this.isLoading$.asObservable();
    readonly errorMessage: Observable<string | null> = this.errorMessage$.asObservable();
    readonly selectedFilter: Observable<string> = this.selectedFilter$.asObservable();
    readonly availableEffectTypes: Observable<string[]> = this.availableEffectTypes$.asObservable();
    readonly maxSlotsFromBackend: Observable<number> = this.maxSlotsFromBackend$.asObservable();
    readonly usedSlotsFromBackend: Observable<number> = this.usedSlotsFromBackend$.asObservable();
    readonly maxCapacity: Observable<number> = this.maxCapacity$.asObservable();
    readonly discardMode: Observable<boolean> = this.discardMode$.asObservable();
    readonly discardQuantity: Observable<number> = this.discardQuantity$.asObservable();
    readonly discardError: Observable<string | null> = this.discardError$.asObservable();
    readonly discardApiError: Observable<string | null> = this.discardApiError$.asObservable();
    readonly isDiscarding: Observable<boolean> = this.isDiscarding$.asObservable();

    getItems(): InventoryItem[] {
        return this.items$.getValue();
    }

    getFilteredItems(): InventoryItem[] {
        return this.filteredItems$.getValue();
    }

    getSelectedItem(): InventoryItem | null {
        return this.selectedItem$.getValue();
    }

    getMaxSlotsFromBackend(): number {
        return this.maxSlotsFromBackend$.getValue();
    }

    getUsedSlotsFromBackend(): number {
        return this.usedSlotsFromBackend$.getValue();
    }

    private getEffectString(effectType: string, effectValue?: number): string {
        if (!effectValue) return 'Cure all status effects';
        const effectMap: Record<string, string> = {
            healing: `+${effectValue}% HP`,
            mana: `+${effectValue}% Mana`,
            xp: `+${effectValue}% XP`,
        };
        return effectMap[effectType] ?? `Effect: ${effectValue}`;
    }

    private transformApiItems(apiItems: ApiInventoryItem[]): InventoryItem[] {
        return apiItems.map((item) => {
            const path = item.icon_path.startsWith('/') ? item.icon_path : `/${item.icon_path}`;
            return {
                id: item.id,
                name: item.name,
                iconPath: this.auth.getAssetUrl(path),
                category: item.effect_type,
                type: item.effect_type,
                description: item.description,
                effect: this.getEffectString(item.effect_type, item.effect_value),
                effect_type: item.effect_type,
                effect_value: item.effect_value,
                is_stackable: item.is_stackable,
                max_quantity: item.max_quantity,
                quantity: item.quantity,
                bag_item_id: item.bag_item_id,
            };
        });
    }

    private extractEffectTypes(items: InventoryItem[]): void {
        const effectTypes = new Set<string>();
        items.forEach((item) => {
            if (item.effect_type) effectTypes.add(item.effect_type);
        });
        this.availableEffectTypes$.next(Array.from(effectTypes).sort());
    }

    loadInventory(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.isLoading$.next(true);
        this.errorMessage$.next(null);
        this.http.get<InventoryApiResponse>(`${this.apiUrl}/inventory`).subscribe({
            next: (response) => {
                const visibleItems = (response.data.items ?? []).filter(
                    (row) => row.effect_type !== 'Gacha Ticket',
                );
                const transformed = this.transformApiItems(visibleItems).sort((a, b) =>
                    (a.effect_type ?? '').localeCompare(b.effect_type ?? ''),
                );
                this.items$.next(transformed);
                this.maxSlotsFromBackend$.next(response.data.max_slots ?? 20);
                this.usedSlotsFromBackend$.next(response.data.used_slots ?? 0);
                this.maxCapacity$.next(response.data.max_slots ?? 20);
                this.extractEffectTypes(transformed);
                this.filteredItems$.next(transformed);
                this.isLoading$.next(false);
                if (transformed.length > 0) {
                    this.selectItem(transformed[0]);
                }
            },
            error: (error) => {
                this.errorMessage$.next(
                    `Failed to load inventory. Error: ${error.status} - ${error.message}`,
                );
                this.isLoading$.next(false);
            },
        });
    }

    applyFilter(effectType: string): void {
        this.selectedFilter$.next(effectType);
        const items = this.items$.getValue();
        if (effectType === 'all') {
            this.filteredItems$.next(items);
        } else {
            this.filteredItems$.next(items.filter((item) => item.effect_type === effectType));
        }
        this.selectedItem$.next(null);
    }

    selectItem(item: InventoryItem): void {
        this.selectedItem$.next(item);
    }

    discardItem(): void {
        const item = this.selectedItem$.getValue();
        if (!item?.bag_item_id) return;
        this.discardQuantity$.next(1);
        this.discardError$.next(null);
        this.discardApiError$.next(null);
        this.discardMode$.next(true);
    }

    updateDiscardQuantity(val: number): void {
        const max = this.selectedItem$.getValue()?.quantity ?? 1;
        const parsed = Math.floor(val);
        this.discardQuantity$.next(parsed);
        this.discardApiError$.next(null);
        if (!parsed || isNaN(parsed)) {
            this.discardError$.next('Please enter a valid number.');
        } else if (parsed < 1) {
            this.discardError$.next('Quantity must be at least 1.');
        } else if (parsed > max) {
            this.discardError$.next(`You only have ${max} unit${max > 1 ? 's' : ''} in stock.`);
        } else {
            this.discardError$.next(null);
        }
    }

    confirmDiscard(): void {
        const item = this.selectedItem$.getValue();
        if (!item?.bag_item_id) return;
        const qty = this.discardQuantity$.getValue();
        if (qty < 1 || qty > item.quantity || this.discardError$.getValue()) return;
        this.callDiscardApi(item.bag_item_id, qty);
    }

    cancelDiscard(): void {
        this.discardMode$.next(false);
        this.discardError$.next(null);
        this.discardApiError$.next(null);
    }

    private callDiscardApi(bagItemId: number, quantity: number): void {
        this.isDiscarding$.next(true);
        this.http
            .delete<{ message: string; remaining: number }>(`${this.apiUrl}/inventory/item/${bagItemId}`, {
                body: { quantity },
            })
            .subscribe({
                next: () => {
                    this.discardMode$.next(false);
                    this.discardError$.next(null);
                    this.discardApiError$.next(null);
                    this.isDiscarding$.next(false);
                    this.selectedItem$.next(null);
                    this.loadInventory();
                },
                error: (err) => {
                    const msg =
                        err?.error?.message ?? err?.message ?? 'Unexpected error. Please try again.';
                    this.discardApiError$.next(msg);
                    this.isDiscarding$.next(false);
                },
            });
    }

    useItem(
        bagItemId: number,
        adquiredXuxemonId: number,
        onSuccess?: (data?: UseItemResponseData) => void,
        onError?: (message: string) => void,
    ): void {
        this.http
            .post<{ message: string; data?: UseItemResponseData }>(
                `${this.apiUrl}/inventory/use`,
                { bag_item_id: bagItemId, adquired_xuxemon_id: adquiredXuxemonId },
            )
            .subscribe({
                next: (response) => {
                    this.loadInventory();
                    onSuccess?.(response.data);
                },
                error: (err) => {
                    const msg = err?.error?.message ?? err?.message ?? 'Failed to use item.';
                    onError?.(msg);
                },
            });
    }
}

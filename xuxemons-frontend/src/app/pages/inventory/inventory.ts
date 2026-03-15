import {
    Component,
    ChangeDetectionStrategy,
    inject,
    afterNextRender,
    signal,
    computed,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import type { InventoryItem } from '../../core/interfaces';
import { InventoryService } from '../../core/services/inventory.service';

@Component({
    selector: 'app-inventory',
    imports: [NgClass, FormsModule],
    templateUrl: './inventory.html',
    styleUrl: './inventory.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit, OnDestroy {
    private inventoryService = inject(InventoryService);
    private subs = new Subscription();

    readonly items = signal<InventoryItem[]>([]);
    readonly filteredItems = signal<InventoryItem[]>([]);
    readonly selectedItem = signal<InventoryItem | null>(null);
    readonly isLoading = signal(true);
    readonly errorMessage = signal<string | null>(null);
    readonly selectedFilter = signal('all');
    readonly availableEffectTypes = signal<string[]>([]);
    readonly maxSlotsFromBackend = signal(0);
    readonly usedSlotsFromBackend = signal(0);
    readonly discardMode = signal(false);
    readonly discardQuantity = signal(1);
    readonly discardError = signal<string | null>(null);
    readonly discardApiError = signal<string | null>(null);
    readonly isDiscarding = signal(false);

    readonly maxSlots = this.inventoryService.maxSlots;

    readonly emptySlots = computed(() => {
        const remaining = this.maxSlots - this.filteredItems().length;
        return Array(Math.max(0, remaining)).fill(0);
    });

    readonly usedCapacity = computed(() =>
        this.usedSlotsFromBackend() > 0 ? this.usedSlotsFromBackend() : this.items().length,
    );

    readonly totalCapacity = computed(() =>
        this.maxSlotsFromBackend() > 0 ? this.maxSlotsFromBackend() : 50,
    );

    readonly availableCapacity = computed(() => this.totalCapacity() - this.usedCapacity());

    constructor() {
        afterNextRender(() => {
            this.inventoryService.loadInventory();
        });
    }

    ngOnInit(): void {
        this.subs.add(this.inventoryService.items.subscribe((v) => this.items.set(v)));
        this.subs.add(this.inventoryService.filteredItems.subscribe((v) => this.filteredItems.set(v)));
        this.subs.add(this.inventoryService.selectedItem.subscribe((v) => this.selectedItem.set(v)));
        this.subs.add(this.inventoryService.isLoading.subscribe((v) => this.isLoading.set(v)));
        this.subs.add(this.inventoryService.errorMessage.subscribe((v) => this.errorMessage.set(v)));
        this.subs.add(this.inventoryService.selectedFilter.subscribe((v) => this.selectedFilter.set(v)));
        this.subs.add(
            this.inventoryService.availableEffectTypes.subscribe((v) => this.availableEffectTypes.set(v)),
        );
        this.subs.add(
            this.inventoryService.maxSlotsFromBackend.subscribe((v) => this.maxSlotsFromBackend.set(v)),
        );
        this.subs.add(
            this.inventoryService.usedSlotsFromBackend.subscribe((v) => this.usedSlotsFromBackend.set(v)),
        );
        this.subs.add(this.inventoryService.discardMode.subscribe((v) => this.discardMode.set(v)));
        this.subs.add(this.inventoryService.discardQuantity.subscribe((v) => this.discardQuantity.set(v)));
        this.subs.add(this.inventoryService.discardError.subscribe((v) => this.discardError.set(v)));
        this.subs.add(this.inventoryService.discardApiError.subscribe((v) => this.discardApiError.set(v)));
        this.subs.add(this.inventoryService.isDiscarding.subscribe((v) => this.isDiscarding.set(v)));
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    loadInventory(): void {
        this.inventoryService.loadInventory();
    }

    applyFilter(effectType: string): void {
        this.inventoryService.applyFilter(effectType);
    }

    selectItem(item: InventoryItem): void {
        this.inventoryService.selectItem(item);
    }

    useItem(): void {
        const item = this.selectedItem();
        if (item && item.quantity > 0) {
            // Implement use logic here
        }
    }

    discardItem(): void {
        this.inventoryService.discardItem();
    }

    updateDiscardQuantity(val: number): void {
        this.inventoryService.updateDiscardQuantity(val);
    }

    confirmDiscard(): void {
        this.inventoryService.confirmDiscard();
    }

    cancelDiscard(): void {
        this.inventoryService.cancelDiscard();
    }

    getSlotClass(item: InventoryItem): string {
        const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
        return `slot-bg-${effectType}`;
    }

    getTagClass(): string {
        const item = this.selectedItem();
        if (!item) return 'tag-default';
        const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
        return `tag-${effectType}`;
    }

    getIconBackgroundClass(): string {
        const item = this.selectedItem();
        if (!item) return 'icon-bg-default';
        const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
        return `icon-bg-${effectType}`;
    }
}

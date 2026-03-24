import {
    Component,
    ChangeDetectionStrategy,
    HostListener,
    AfterViewChecked,
    ElementRef,
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
import type { Xuxemon } from '../../core/interfaces';
import { InventoryService } from '../../core/services/inventory.service';
import { XuxemonService } from '../../core/services/xuxemon.service';

@Component({
    selector: 'app-inventory',
    imports: [NgClass, FormsModule],
    templateUrl: './inventory.html',
    styleUrl: './inventory.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit, OnDestroy, AfterViewChecked {
    private inventoryService = inject(InventoryService);
    private xuxemonService = inject(XuxemonService);
    private elementRef = inject(ElementRef<HTMLElement>);
    private subs = new Subscription();
    private focusUseItemSearch = false;

    readonly items = signal<InventoryItem[]>([]);
    readonly myXuxemons = signal<Xuxemon[]>([]);
    readonly useModalOpen = signal(false);
    readonly useSearchQuery = signal('');
    readonly selectedXuxemonForUse = signal<Xuxemon | null>(null);
    readonly useApiError = signal<string | null>(null);
    readonly isUsing = signal(false);
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

    readonly inventorySlots = computed(() => {
        const items = this.filteredItems();
        const total = this.maxSlots;
        const slots: { slotNumber: number; item?: InventoryItem }[] = [];
        for (let i = 0; i < total; i++) {
            slots.push({
                slotNumber: i + 1,
                item: items[i],
            });
        }
        return slots;
    });

    getSlotAriaLabel(slot: { slotNumber: number; item?: InventoryItem }): string {
        if (slot.item) {
            return `Slot ${slot.slotNumber} - ${slot.item.quantity} ${slot.item.name}`;
        }
        return `Slot ${slot.slotNumber} - empty`;
    }

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
        this.subs.add(this.xuxemonService.myXuxemonsList.subscribe((v) => this.myXuxemons.set(v)));
    }

    readonly useModalXuxemons = computed(() => {
        const list = this.myXuxemons();
        const q = this.useSearchQuery().toLowerCase().trim();
        const item = this.selectedItem();
        const isSpecialMeat = item?.name === 'Special Meat';
        const isHealingItem = item?.effect_type === 'Heal';
        const isRemoveStatusItem = item?.effect_type === 'Remove Status Effects';
        let filtered = list.filter(
            (x) =>
                (x.name ?? '').toLowerCase().includes(q) &&
                (x.adquired_id != null),
        );
        if (isSpecialMeat) {
            filtered = filtered.filter((x) => x.size !== 'Large');
        }
        if (isHealingItem) {
            filtered = filtered.filter((x) => (x.current_hp ?? x.hp!) < x.hp!);
        }
        if (isRemoveStatusItem) {
            filtered = filtered.filter((x) => Boolean(x.statusEffect?.name));
        }
        return filtered;
    });

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

    onSlotEnter(item: InventoryItem): void {
        this.selectItem(item);
        this.openUseModal();
    }

    openUseModal(): void {
        this.useApiError.set(null);
        this.selectedXuxemonForUse.set(null);
        this.useSearchQuery.set('');
        this.xuxemonService.loadMyXuxemons();
        this.useModalOpen.set(true);
        this.focusUseItemSearch = true;
    }

    ngAfterViewChecked(): void {
        if (!this.focusUseItemSearch) return;
        const input = this.elementRef.nativeElement.querySelector('.use-item-search');
        if (input instanceof HTMLInputElement) {
            setTimeout(() => input.focus(), 0);
            this.focusUseItemSearch = false;
        }
    }

    closeUseModal(): void {
        this.useModalOpen.set(false);
        this.selectedXuxemonForUse.set(null);
        this.useApiError.set(null);
    }

    setUseSearchQuery(value: string): void {
        this.useSearchQuery.set(value);
    }

    selectXuxemonForUse(xuxemon: Xuxemon): void {
        this.selectedXuxemonForUse.set(xuxemon);
        this.useApiError.set(null);
    }

    confirmUseItem(): void {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        if (!item?.bag_item_id || !xuxemon?.adquired_id) return;
        this.isUsing.set(true);
        this.useApiError.set(null);
        this.inventoryService.useItem(
            item.bag_item_id,
            xuxemon.adquired_id,
            () => {
                this.isUsing.set(false);
                this.closeUseModal();
                this.xuxemonService.loadMyXuxemons();
            },
            (msg) => {
                this.useApiError.set(msg);
                this.isUsing.set(false);
            },
        );
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

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.useModalOpen()) this.closeUseModal();
        else if (this.discardMode()) this.cancelDiscard();
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

    /** Devuelve { healed, newHp } para mostrar el preview de curación en el modal */
    getHealPreview(xu: Xuxemon): { healed: number; newHp: number } {
        const item = this.selectedItem();
        const maxHp = xu.hp ?? 0;
        const currentHp = xu.current_hp ?? maxHp;
        const pct = item?.effect_value ?? 0;
        const healed = Math.round(maxHp * pct / 100);
        const newHp = Math.min(currentHp + healed, maxHp);
        return { healed, newHp };
    }

    getStatBuffPreview(xu: Xuxemon, stat: 'attack' | 'defense'): { boosted: number } {
        const item = this.selectedItem();
        const pct = item?.effect_value ?? 0;
        const current = stat === 'attack' ? (xu.attack ?? 0) : (xu.defense ?? 0);
        const gain = Math.round((current * pct) / 100);
        return { boosted: current + gain };
    }
}

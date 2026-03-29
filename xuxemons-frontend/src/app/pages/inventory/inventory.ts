
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
import { EvolutionSequence } from '../../core/components/evolution-sequence/evolution-sequence';
import type { InventoryItem, UseItemResponseData, Xuxemon, XuxemonSize } from '../../core/interfaces';
import { AuthService } from '../../core/services/auth';
import { InventoryService } from '../../core/services/inventory.service';
import { XuxemonService } from '../../core/services/xuxemon.service';

@Component({
    selector: 'app-inventory',
    imports: [NgClass, FormsModule, EvolutionSequence],
    templateUrl: './inventory.html',
    styleUrl: './inventory.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit, OnDestroy, AfterViewChecked {
        readonly useOverdoseInfo = signal<string | null>(null);
    private auth = inject(AuthService);
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
    readonly useStarvingInfo = signal<string | null>(null);
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
    readonly evolutionAnimation = signal<{
        spriteUrl: string;
        spriteName: string;
        fromSize: XuxemonSize;
        toSize: XuxemonSize;
    } | null>(null);

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

        // --- Lógica para cantidad de uso de Special Meat ---
    readonly useQuantity = signal(1);
    readonly useQuantityError = signal<string | null>(null);

    // Calcula el máximo de carnes que se pueden usar según inventario, progreso y estado
    maxUsableSpecialMeat(): number {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        if (!item || item.name !== 'Special Meat' || !xuxemon) return 1;
        const meatInBag = item.quantity ?? 1;
        // Preferir requirement_total si está en la última respuesta del backend
        let progress = xuxemon.requirement_progress ?? 0;
        let total = xuxemon.requirement_total ?? null;
        // Si la última respuesta de uso de item tiene requirement_total, úsala
        const lastUseData = (this as any).lastUseItemData as any;
        if (lastUseData && typeof lastUseData.requirement_total === 'number') {
            total = lastUseData.requirement_total;
            progress = lastUseData.requirement_progress ?? progress;
        }
        if (typeof total !== 'number' || total < 1) total = progress + 1;
        const needed = Math.max(0, total - progress);
        const hasStarving = xuxemon.side_effect_1?.name === 'Starving' || xuxemon.side_effect_2?.name === 'Starving' || xuxemon.side_effect_3?.name === 'Starving';
        if (hasStarving) {
            return Math.min(Math.floor(meatInBag / 2), needed);
        } else {
            return Math.min(meatInBag, needed);
        }
    }
        // Muestra error si está en Starving y solo tiene una carne
    showStarvingMeatError(): boolean {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        if (!item || item.name !== 'Special Meat' || !xuxemon) return false;
        const hasStarving = xuxemon.side_effect_1?.name === 'Starving' || xuxemon.side_effect_2?.name === 'Starving' || xuxemon.side_effect_3?.name === 'Starving';
        return hasStarving && (item.quantity === 1);
    }


    // Actualiza la cantidad a usar y valida
    updateUseQuantity(val: number): void {
        const max = this.maxUsableSpecialMeat();
        const parsed = Math.floor(val);
        this.useQuantity.set(parsed);
        if (!parsed || isNaN(parsed)) {
            this.useQuantityError.set('Please enter a valid number.');
        } else if (parsed < 1) {
            this.useQuantityError.set('Quantity must be at least 1.');
        } else if (parsed > max) {
            this.useQuantityError.set(`You can use up to ${max}.`);
        } else if (this.showStarvingMeatError()) {
            this.useQuantityError.set('You do not have enough Special Meat: Starving requires 2 per progress.');
        } else {
            this.useQuantityError.set(null);
        }
    }

    // Calcula cuántas carnes se consumirán para la cantidad seleccionada
    getMeatToConsumeForQuantity(qty: number): number {
        const xuxemon = this.selectedXuxemonForUse();
        if (!xuxemon) return qty;
        const hasStarving = xuxemon.side_effect_1?.name === 'Starving' || xuxemon.side_effect_2?.name === 'Starving' || xuxemon.side_effect_3?.name === 'Starving';
        return hasStarving ? qty * 2 : qty;
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
        const isYellowMushroom = item?.name === 'Yellow Mushroom';
        const isRedMushroom = item?.name === 'Red Mushroom';
        const isNulberry = item?.name === 'Nulberry';

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

        if (isYellowMushroom) {
            filtered = filtered.filter((x) => 
                x.side_effect_1?.name === 'Gluttony' || 
                x.side_effect_2?.name === 'Gluttony' || 
                x.side_effect_3?.name === 'Gluttony'
            );
        } else if (isRedMushroom) {
            filtered = filtered.filter((x) => 
                x.side_effect_1?.name === 'Starving' || 
                x.side_effect_2?.name === 'Starving' || 
                x.side_effect_3?.name === 'Starving'
            );
        } else if (isNulberry) {
            // Nulberry cures everything (Status AND Side Effects)
            filtered = filtered.filter((x) => 
                Boolean(x.statusEffect?.name) || 
                Boolean(x.side_effect_1?.name) || 
                Boolean(x.side_effect_2?.name) || 
                Boolean(x.side_effect_3?.name)
            );
        } else if (isRemoveStatusItem) {
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
        this.useQuantity.set(1);
        this.useQuantityError.set(null);
        this.useStarvingInfo.set(null);
        (this as any).lastUseItemData = undefined;
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
        this.useQuantityError.set(null);
        this.useStarvingInfo.set(null);
        this.useOverdoseInfo?.set?.(null);
        (this as any).lastUseItemData = undefined;
        this.useQuantity.set(1);
        // Mostrar info de overdose o starving si corresponde al seleccionar
        const item = this.selectedItem();
        const hasStarving =
            xuxemon.side_effect_1?.name === 'Starving' ||
            xuxemon.side_effect_2?.name === 'Starving' ||
            xuxemon.side_effect_3?.name === 'Starving';
        const hasOverdose =
            xuxemon.side_effect_1?.name === 'Overdose' ||
            xuxemon.side_effect_2?.name === 'Overdose' ||
            xuxemon.side_effect_3?.name === 'Overdose';
        if (item?.name === 'Special Meat' && hasOverdose) {
            this.useOverdoseInfo.set('Your Xuxemon is affected by Overdose, cannot eat Special Meat, and its size has been reduced.');
        } else if (item?.name === 'Special Meat' && hasStarving) {
            this.useStarvingInfo.set('This Xuxemon is Starving and will consume 2 Special Meat for 1 progress.');
        } else {
            this.useStarvingInfo.set(null);
            this.useOverdoseInfo?.set?.(null);
        }
    }

    confirmUseItem(): void {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        const qty = this.useQuantity();
        if (!item?.bag_item_id || !xuxemon?.adquired_id) return;
        if (item.name === 'Special Meat' && this.useQuantityError()) return;
        this.isUsing.set(true);
        this.useApiError.set(null);
        this.useStarvingInfo.set(null);
        this.inventoryService.useItem(
            item.bag_item_id,
            xuxemon.adquired_id,
            (data) => {
                this.isUsing.set(false);
                // Guardar la última respuesta para requirement_total
                (this as any).lastUseItemData = data;
                if (data && (data as any).gluttony_blocked) {
                    this.closeUseModal();
                    this.errorMessage.set((data as any).message || 'This Xuxemon cannot eat due to Gluttony.');
                    return;
                }
                if (data && (data as any).starving_info) {
                    this.useStarvingInfo.set((data as any).starving_info);
                } else {
                    this.useStarvingInfo.set(null);
                }
                this.closeUseModal();
                if (item.effect_type === 'Evolve') {
                    this.openEvolutionAnimation(xuxemon, data);
                }
                this.xuxemonService.loadMyXuxemons();
            },
            (msg) => {
                this.useApiError.set(msg);
                this.isUsing.set(false);
            },
            item.name === 'Special Meat' ? qty : undefined
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

    closeEvolutionAnimation(): void {
        this.evolutionAnimation.set(null);
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

    isEffectTargeted(effectName: string | undefined, isStatusEffect: boolean = false): boolean {
        const item = this.selectedItem();
        if (!item || !effectName) return false;
        if (item.name === 'Yellow Mushroom' && effectName === 'Gluttony') return true;
        if (item.name === 'Red Mushroom' && effectName === 'Starving') return true;
        if (item.name === 'Nulberry') return true; // Cures any status and any side effect
        return false;
    }

    getStatBuffPreview(xu: Xuxemon, stat: 'attack' | 'defense'): { boosted: number } {
        const item = this.selectedItem();
        const value = item?.effect_value ?? 0;
        const current = stat === 'attack' ? (xu.attack ?? 0) : (xu.defense ?? 0);
        if (stat === 'defense') {
            // Defense Up adds flat points
            return { boosted: current + value };
        }
        // DMG Up uses percentage
        const gain = Math.round((current * value) / 100);
        return { boosted: current + gain };
    }
    
    private openEvolutionAnimation(xuxemon: Xuxemon, data?: UseItemResponseData): void {
        const viewAnimations = this.auth.getUser()?.view_animations ?? true;
        if (!viewAnimations) {
            return;
        }
        const fromSize = this.normalizeSize(xuxemon.size);
        const toSize = this.normalizeSize(data?.xuxemon_size, fromSize);
        if (toSize === fromSize) {
            return;
        }
        this.evolutionAnimation.set({
            spriteUrl: xuxemon.image_url,
            spriteName: xuxemon.name ?? 'Xuxemon',
            fromSize,
            toSize,
        });
    }

    private normalizeSize(value?: string, fallback: XuxemonSize = 'Small'): XuxemonSize {
        if (value === 'Small' || value === 'Medium' || value === 'Large') {
            return value;
        }
        return fallback;
    }

    getEvolvePreview(xu: Xuxemon): { willEvolve: boolean; fromSize: XuxemonSize; toSize: XuxemonSize } {
        const fromSize = this.normalizeSize(xu.size);
        const toSize = this.normalizeSize(xu.next_size, fromSize);
        return { willEvolve: Boolean(xu.will_evolve_next), fromSize, toSize };
    }
}

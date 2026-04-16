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
import { DiscardItemModal } from '../../core/components/modals/discard-item-modal/discard-item-modal';
import { UseItemModal } from '../../core/components/modals/use-item-modal/use-item-modal';
import type { InventoryItem, UseItemResponseData, Xuxemon, XuxemonSize } from '../../core/interfaces';
import { AuthService } from '../../core/services/auth';
import { InventoryService } from '../../core/services/inventory.service';
import { XuxemonService } from '../../core/services/xuxemon.service';

@Component({
    selector: 'app-inventory',
    imports: [NgClass, FormsModule, EvolutionSequence, UseItemModal, DiscardItemModal],
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
    private focusDiscardCancelButton = false;
    private previousFocusedElement: HTMLElement | null = null;

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

    private hasSideEffect(xuxemon: Xuxemon | null | undefined, effectName: string): boolean {
        if (!xuxemon) return false;

        return xuxemon.side_effect_1?.name === effectName
            || xuxemon.side_effect_2?.name === effectName
            || xuxemon.side_effect_3?.name === effectName;
    }

    isGluttonyBlocked(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): boolean {
        return this.selectedItem()?.name === 'Special Meat' && this.hasSideEffect(xuxemon, 'Gluttony');
    }

    isOverdoseBlocked(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): boolean {
        return this.selectedItem()?.name === 'Special Meat' && this.hasSideEffect(xuxemon, 'Overdose');
    }

    isSpecialMeatUseBlocked(): boolean {
        return this.isGluttonyBlocked() || this.isOverdoseBlocked();
    }

    getSpecialMeatBlockMessage(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): string | null {
        if (this.selectedItem()?.name !== 'Special Meat' || !xuxemon) return null;
        if (this.hasSideEffect(xuxemon, 'Gluttony')) {
            return 'Your Xuxemon is affected by Gluttony and cannot eat Special Meat.';
        }
        if (this.hasSideEffect(xuxemon, 'Overdose')) {
            return 'Your Xuxemon is affected by Overdose, cannot eat Special Meat, and its size has been reduced.';
        }

        return null;
    }

    isUseActionDisabled(): boolean {
        if (!this.selectedXuxemonForUse() || this.isUsing()) return true;
        if (this.isSpecialMeatUseBlocked()) return true;
        const item = this.selectedItem();
        const isEvolve = item?.effect_type === 'Evolve';
        const isSpecialMeat = item?.name === 'Special Meat';
        if ((isSpecialMeat || isEvolve) && this.maxUsableSpecialMeat() === 0) return true;

        if ((isSpecialMeat || isEvolve) && Boolean(this.useQuantityError())) return true;

        return false;
    }

    isStarvingSelected(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): boolean {
        return this.selectedItem()?.name === 'Special Meat' && this.hasSideEffect(xuxemon, 'Starving');
    }

    getUseQuantityStep(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): number {
        return this.isStarvingSelected(xuxemon) ? 2 : 1;
    }

    getUseQuantityMin(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): number {
        return this.isStarvingSelected(xuxemon) ? 2 : 1;
    }

    getProgressForUseQuantity(qty: number, xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): number {
        if (!Number.isFinite(qty) || qty <= 0) return 0;

        return this.isStarvingSelected(xuxemon) ? Math.floor(qty / 2) : Math.floor(qty);
    }

    private getNormalizedUseQuantity(value: number, xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): number {
        const step = this.getUseQuantityStep(xuxemon);
        const min = this.getUseQuantityMin(xuxemon);
        const max = this.maxUsableSpecialMeat();
        let normalized = Math.floor(value);

        if (!Number.isFinite(normalized)) return normalized;
        if (this.isStarvingSelected(xuxemon) && normalized % 2 !== 0) {
            normalized += 1;
        }
        if (normalized < min) {
            normalized = min;
        }
        if (max > 0 && normalized > max) {
            normalized = max;
            if (this.isStarvingSelected(xuxemon) && normalized % 2 !== 0) {
                normalized = Math.max(min, normalized - 1);
            }
        }

        return normalized;
    }

    getInitialUseQuantity(xuxemon: Xuxemon | null | undefined = this.selectedXuxemonForUse()): number {
        if (this.isStarvingSelected(xuxemon) && this.maxUsableSpecialMeat() >= 2) {
            return 2;
        }

        return 1;
    }

    private getTotalItemQuantity(itemName: string): number {
        return this.items()
            .filter(i => i.name === itemName)
            .reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    }

    // Calcula el máximo de carnes que se pueden usar según inventario, progreso y estado
    maxUsableSpecialMeat(): number {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        if (!item || item.name !== 'Special Meat' || !xuxemon) return 1;
        const totalMeat = this.getTotalItemQuantity('Special Meat');
        let progress = xuxemon.requirement_progress ?? 0;
        const lastUseData = (this as any).lastUseItemData as any;
        if (lastUseData && typeof lastUseData.requirement_progress === 'number') {
            progress = lastUseData.requirement_progress ?? progress;
        }
        // Calcular cuánto falta para el próximo tamaño usando requirement_total_max > requirement_total > size_breakpoints
        const requirementMax = (xuxemon.requirement_total_max as number) ?? (xuxemon.requirement_total as number) ?? null;
        const needed = typeof requirementMax === 'number' ? Math.max(0, requirementMax - progress) : 1;
        const hasStarving = this.hasSideEffect(xuxemon, 'Starving');
        if (hasStarving) {
            return Math.min(totalMeat - (totalMeat % 2), needed * 2);
        } else {
            return Math.min(totalMeat, needed);
        }
    }
        // Muestra error si está en Starving y solo tiene una carne
    showStarvingMeatError(): boolean {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        if (!item || item.name !== 'Special Meat' || !xuxemon) return false;
        const hasStarving = xuxemon.side_effect_1?.name === 'Starving' || xuxemon.side_effect_2?.name === 'Starving' || xuxemon.side_effect_3?.name === 'Starving';
        return hasStarving && (this.getTotalItemQuantity('Special Meat') < 2);
    }


    // Actualiza la cantidad a usar y valida
    updateUseQuantity(val: number): void {
        const max = this.maxUsableSpecialMeat();
        const totalStock = this.getTotalItemQuantity(this.selectedItem()?.name ?? '');
        const parsed = Math.floor(val);
        const normalized = this.getNormalizedUseQuantity(parsed);
        this.useQuantity.set(Number.isFinite(normalized) ? normalized : parsed);
        if (!parsed || isNaN(parsed)) {
            this.useQuantityError.set('Please enter a valid number.');
        } else if (this.isStarvingSelected() && parsed < 2) {
            this.useQuantityError.set('Quantity must be at least 2 while Starving.');
        } else if (!this.isStarvingSelected() && parsed < 1) {
            this.useQuantityError.set('Quantity must be at least 1.');
        } else if (this.isStarvingSelected() && parsed % 2 !== 0) {
            this.useQuantityError.set(null);
        } else if (totalStock > 0 && parsed > totalStock) {
            this.useQuantityError.set(`You only have ${totalStock} units in stock.`);
        } else if (max > 0 && parsed > max) {
            this.useQuantityError.set(`You can use up to ${max}.`);
        } else if (this.showStarvingMeatError()) {
            this.useQuantityError.set('You do not have enough Special Meat: Starving requires 2 per progress.');
        } else if (max === 0) {
            this.useQuantityError.set(null);
        } else {
            this.useQuantityError.set(null);
        }
    }

    // Calcula cuántas carnes se consumirán para la cantidad seleccionada
    getMeatToConsumeForQuantity(qty: number): number {
        return Math.max(0, Math.floor(qty));
    }

    // Devuelve el tamaño resultante para un progreso dado usando los size_breakpoints
    private resolveSizeForProgress(progress: number, sizeBreakpoints?: Record<string, number>): 'Small' | 'Medium' | 'Large' {
        if (!sizeBreakpoints || Object.keys(sizeBreakpoints).length === 0) return 'Small';
        let chosen: string = 'Small';
        const entries = Object.entries(sizeBreakpoints).map(([k, v]) => [k, Number(v)] as [string, number]);
        entries.sort((a, b) => a[1] - b[1]);
        for (const [sizeName, req] of entries) {
            if (progress >= req) chosen = sizeName;
        }
        if (chosen === 'Small' || chosen === 'Medium' || chosen === 'Large') return chosen as any;
        return 'Small';
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
        this.previousFocusedElement = typeof document !== 'undefined'
            ? (document.activeElement as HTMLElement | null)
            : null;
        this.useApiError.set(null);
        this.selectedXuxemonForUse.set(null);
        this.useSearchQuery.set('');
        this.useQuantity.set(1);
        this.useQuantityError.set(null);
        this.useStarvingInfo.set(null);
        this.useOverdoseInfo.set(null);
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

        if (this.focusDiscardCancelButton) {
            const cancelButton = this.elementRef.nativeElement.querySelector('.discard-cancel-button');
            if (cancelButton instanceof HTMLButtonElement) {
                setTimeout(() => cancelButton.focus(), 0);
            }
            this.focusDiscardCancelButton = false;
        }
    }

    closeUseModal(): void {
        this.useModalOpen.set(false);
        this.selectedXuxemonForUse.set(null);
        this.useApiError.set(null);
        this.useStarvingInfo.set(null);
        this.useOverdoseInfo.set(null);
        this.restorePreviousFocus();
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
        this.useQuantity.set(this.getInitialUseQuantity(xuxemon));
        // Mostrar info de overdose o starving si corresponde al seleccionar
        const item = this.selectedItem();
        const hasStarving = this.hasSideEffect(xuxemon, 'Starving');
        if (item?.name === 'Special Meat' && this.isOverdoseBlocked(xuxemon)) {
            this.useOverdoseInfo.set(this.getSpecialMeatBlockMessage(xuxemon));
        } else if (item?.name === 'Special Meat' && hasStarving) {
            this.useStarvingInfo.set('This Xuxemon is Starving and will consume 2 Special Meat for 1 progress.');
        } else {
            this.useStarvingInfo.set(null);
            this.useOverdoseInfo?.set?.(null);
        }
        // Foco automático en el botón + si corresponde
        setTimeout(() => {
            if (item?.name === 'Special Meat' && !this.isSpecialMeatUseBlocked()) {
                const qtyInput = this.elementRef.nativeElement.querySelector('#use-qty-input');
                if (qtyInput instanceof HTMLInputElement) {
                    qtyInput.focus();
                }
            }
        }, 0);
    }

    // Keyboard Enter handler for xuxemon list rows: select and (for non-Special Meat) execute immediately
    onXuxemonEnter(xuxemon: Xuxemon): void {
        this.selectXuxemonForUse(xuxemon);
        const item = this.selectedItem();
        if (!item) return;
        if (item.name !== 'Special Meat') {
            // allow previous selection logic to settle, then confirm
            setTimeout(() => this.confirmUseItem(), 0);
        } else {
            // For Special Meat we move focus to + (already handled in selectXuxemonForUse)
        }
    }

    confirmUseItem(): void {
        const item = this.selectedItem();
        const xuxemon = this.selectedXuxemonForUse();
        const qty = this.getProgressForUseQuantity(this.useQuantity(), xuxemon);
        if (!item?.bag_item_id || !xuxemon?.adquired_id) return;
        if (this.isSpecialMeatUseBlocked()) {
            this.useApiError.set(this.getSpecialMeatBlockMessage(xuxemon));
            return;
        }
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
                    this.useApiError.set((data as any).message || 'This Xuxemon cannot eat due to Gluttony.');
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
        this.previousFocusedElement = typeof document !== 'undefined'
            ? (document.activeElement as HTMLElement | null)
            : null;
        this.focusDiscardCancelButton = true;
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
        this.restorePreviousFocus();
    }

    closeEvolutionAnimation(): void {
        this.evolutionAnimation.set(null);
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.useModalOpen()) this.closeUseModal();
        else if (this.discardMode()) this.cancelDiscard();
    }

    private restorePreviousFocus(): void {
        if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
            setTimeout(() => this.previousFocusedElement?.focus(), 0);
        }
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

    getEvolvePreview(xu: Xuxemon, qty: number = 1): { willEvolve: boolean; fromSize: XuxemonSize; toSize: XuxemonSize } {
        const fromSize = this.normalizeSize(xu.size);
        if (this.hasSideEffect(xu, 'Overdose')) {
            return { willEvolve: false, fromSize, toSize: fromSize };
        }
        // Si tiene Starving, cada progreso requiere 2 carnes
        const hasStarving = xu.side_effect_1?.name === 'Starving' || xu.side_effect_2?.name === 'Starving' || xu.side_effect_3?.name === 'Starving';
        let progressGain = qty;
        if (hasStarving) {
            progressGain = Math.floor(qty / 2);
        }
        const progress = (xu.requirement_progress ?? 0) + progressGain;
        const toSize = this.resolveSizeForProgress(progress, xu.size_breakpoints) ?? fromSize;
        const willEvolve = toSize !== fromSize;
        return { willEvolve, fromSize, toSize };
    }
}

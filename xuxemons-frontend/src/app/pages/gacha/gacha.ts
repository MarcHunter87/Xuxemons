import { Component, inject, signal, OnInit, ViewChild, ElementRef, computed } from '@angular/core';
import { XuxemonService, Xuxemon } from '../../core/services/xuxemon.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-gacha',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './gacha.html',
    styleUrl: './gacha.css',
})
export class Gacha implements OnInit {
    private xuxemonService = inject(XuxemonService);

    public isSpinning = signal(false);
    public showAward = signal(false);
    public awardedXuxemon = signal<Xuxemon | null>(null);
    public noTransition = signal(false);
    public trackTransform = signal<string>('translateX(0)');
    public isDataLoaded = signal(false);

    public rouletteItems = signal<Xuxemon[]>([]);
    public historyXuxemons = computed(() => {
        return this.xuxemonService.myXuxemonsList().slice(0, 6);
    });

    @ViewChild('rouletteBox') rouletteBox!: ElementRef;

    ngOnInit() {
        this.loadRoulette();
        this.xuxemonService.loadMyXuxemons();
    }

    async loadRoulette() {
        await this.xuxemonService.loadAllXuxemons();
        this.isDataLoaded.set(true);
        const all = this.xuxemonService.xuxemonsList();
        if (all.length === 0) return;


        const items: Xuxemon[] = [];
        for (let i = 0; i < 100; i++) {
            items.push(all[Math.floor(Math.random() * all.length)]);
        }
        this.rouletteItems.set(items);
    }

    getTypeColor(typeName: string): string {
        switch (typeName) {
            case 'Power': return 'var(--danger-color)';
            case 'Speed': return 'var(--accent-color)';
            case 'Technical': return 'var(--success-color)';
            default: return '#eee';
        }
    }

    async spin() {
        if (this.isSpinning()) return;


        this.noTransition.set(true);
        this.trackTransform.set('translateX(0)');
        this.showAward.set(false);


        const winner = await this.xuxemonService.awardRandomXuxemon();
        if (!winner) {
            this.isSpinning.set(false);
            this.noTransition.set(false);
            alert('Session expired or error. Please log out and log in again.');
            return;
        }


        const items = [...this.rouletteItems()];
        items[80] = winner;
        this.rouletteItems.set(items);

        this.isSpinning.set(true);

        setTimeout(() => {
            this.noTransition.set(false);
            setTimeout(() => {
                const itemWidth = 188;
                const containerWidth = this.rouletteBox?.nativeElement?.offsetWidth || 1000;
                const offset = -(80 * itemWidth) + (containerWidth / 2) - (itemWidth / 2);
                this.trackTransform.set(`translateX(${offset}px)`);
            }, 20);
        }, 50);

        setTimeout(() => {
            this.isSpinning.set(false);
            this.awardedXuxemon.set(winner);
            this.showAward.set(true);
            this.xuxemonService.loadMyXuxemons();
        }, 6200);
    }

    closeModal() {
        this.showAward.set(false);
        this.awardedXuxemon.set(null);
    }

    spinAgain() {
        this.closeModal();
        this.spin();
    }
}

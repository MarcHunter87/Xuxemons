import { Component, inject, signal, OnInit } from '@angular/core';
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
    public noTransition = signal(false);
    public awardedXuxemon = signal<Xuxemon | null>(null);
    public showAward = signal(false);
    public rouletteItems = signal<Xuxemon[]>([]);
    public trackTransform = signal<string>('translateX(0)');
    public isDataLoaded = signal(false);

    ngOnInit() {
        this.loadRoulette();
    }

    async loadRoulette() {
        await this.xuxemonService.loadAllXuxemons();
        this.isDataLoaded.set(true);
        this.initRoulette();
    }

    initRoulette() {
        const list = this.xuxemonService.xuxemonsList();
        if (list.length > 0) {
            this.rouletteItems.set(Array.from({ length: 100 }, () => list[Math.floor(Math.random() * list.length)]));
        } else {
            this.rouletteItems.set([]);
        }
    }

    async spin() {
        if (this.isSpinning()) return;

        this.showAward.set(false);
        this.awardedXuxemon.set(null);
        this.isSpinning.set(true);

        this.noTransition.set(true);
        this.trackTransform.set('translateX(0)');
        this.initRoulette();

        const winnerPromise = this.xuxemonService.awardRandomXuxemon();

        const winner = await winnerPromise;

        if (!winner) {
            this.isSpinning.set(false);
            this.noTransition.set(false);
            alert('Session expired or error. Please log out and log in again.');
            return;
        }

        this.rouletteItems.update(items => {
            const newItems = [...items];
            newItems[80] = winner;
            return newItems;
        });

        setTimeout(() => {
            this.noTransition.set(false);
            setTimeout(() => {
                const itemWidth = 188;
                const containerWidth = 1000;
                const offset = -(80 * itemWidth) + (containerWidth / 2) - (itemWidth / 2);
                this.trackTransform.set(`translateX(${offset}px)`);
            }, 20);
        }, 50);

        setTimeout(() => {
            this.isSpinning.set(false);
            this.awardedXuxemon.set(winner);
            this.showAward.set(true);
        }, 6200);
    }

    getTypeColor(typeName: string): string {
        switch (typeName) {
            case 'Power': return '#ff4757';
            case 'Speed': return '#1e90ff';
            case 'Technical': return '#2ed573';
            default: return '#eee';
        }
    }

    closeModal() {
        this.showAward.set(false);
        this.awardedXuxemon.set(null);
    }
}

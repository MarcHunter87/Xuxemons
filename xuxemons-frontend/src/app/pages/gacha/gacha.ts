import { Component, HostListener, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { XuxemonService, Xuxemon } from '../../core/services/xuxemon.service';
import { AuthService } from '../../core/services/auth';

@Component({
    selector: 'app-gacha',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './gacha.html',
    styleUrl: './gacha.css',
})
export class Gacha implements OnInit, OnDestroy {
    private xuxemonService = inject(XuxemonService);
    readonly auth = inject(AuthService);
    private subs = new Subscription();

    @ViewChild('rouletteBox') rouletteBox!: ElementRef<HTMLElement>;

    public isSpinning = signal(false);
    public noTransition = signal(false);
    public awardedXuxemon = signal<Xuxemon | null>(null);
    public showAward = signal(false);
    public spinError = signal<string | null>(null);
    public rouletteItems = signal<Xuxemon[]>([]);
    public trackTransform = signal<string>('translateX(0)');
    public isDataLoaded = signal(false);
    public historyXuxemons = computed(() => this.myXuxemonsList().slice(0, 6));
    private myXuxemonsList = signal<Xuxemon[]>([]);

    ngOnInit() {
        this.auth.refreshGachaTickets();
        this.loadRoulette();
        this.xuxemonService.loadMyXuxemons();
        this.subs.add(this.xuxemonService.myXuxemonsList.subscribe(list => this.myXuxemonsList.set(list)));
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
    }

    async loadRoulette() {
        await this.xuxemonService.loadAllXuxemons();
        this.isDataLoaded.set(true);
        this.initRoulette();
    }

    initRoulette() {
        const list = this.xuxemonService.getXuxemonsList();
        if (list.length > 0) {
            this.rouletteItems.set(Array.from({ length: 100 }, () => list[Math.floor(Math.random() * list.length)]));
        } else {
            this.rouletteItems.set([]);
        }
    }

    async spin() {
        if (this.isSpinning()) return;
        if (this.auth.gachaTicketCount() < 1) return;

        this.showAward.set(false);
        this.awardedXuxemon.set(null);
        this.spinError.set(null);
        this.isSpinning.set(true);

        this.noTransition.set(true);
        this.trackTransform.set('translateX(0)');
        this.initRoulette();

        const winner = await this.xuxemonService.awardRandomXuxemon();

        if (!winner) {
            this.isSpinning.set(false);
            this.noTransition.set(false);
            this.spinError.set(
                "Couldn't complete the spin. Make sure you have tickets and your session is still active."
            );
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
                const containerWidth = this.rouletteBox?.nativeElement?.offsetWidth ?? 1000;
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

    spinAgain() {
        this.closeModal();
        this.spin();
    }

    getTypeColor(typeName: string): string {
        switch (typeName) {
            case 'Power': return '#D0181B';
            case 'Speed': return '#0D6EFD';
            case 'Technical': return '#28A745';
            default: return '#777';
        }
    }

    closeModal() {
        this.showAward.set(false);
        this.awardedXuxemon.set(null);
    }

    closeSpinError(): void {
        this.spinError.set(null);
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.spinError()) {
            this.closeSpinError();
            return;
        }
        if (this.showAward()) this.closeModal();
    }
}

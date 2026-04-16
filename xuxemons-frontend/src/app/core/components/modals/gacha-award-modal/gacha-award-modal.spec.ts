import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GachaAwardModal } from './gacha-award-modal';

describe('GachaAwardModal', () => {
  let component: GachaAwardModal;
  let fixture: ComponentFixture<GachaAwardModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GachaAwardModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GachaAwardModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

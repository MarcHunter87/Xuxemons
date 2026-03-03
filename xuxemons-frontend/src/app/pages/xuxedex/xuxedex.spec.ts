import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Xuxedex } from './xuxedex';

describe('Xuxedex', () => {
  let component: Xuxedex;
  let fixture: ComponentFixture<Xuxedex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Xuxedex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Xuxedex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

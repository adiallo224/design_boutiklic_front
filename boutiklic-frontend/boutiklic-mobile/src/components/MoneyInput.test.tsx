// react-test-renderer et react-native résolvent React à la RACINE du monorepo, alors que le code de l'app pourrait
// résoudre la copie du dossier mobile : deux copies de React → « Invalid hook call ». On les aligne sur celle du renderer.
jest.mock('react', () => jest.requireActual(require.resolve('react', { paths: [require('path').dirname(require.resolve('react-test-renderer'))] })))
// Le babel de l'app compile le JSX vers le runtime NativeWind, introuvable depuis les fichiers react-native de la racine.
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'), { virtual: true })
jest.mock('react-native-css-interop/jsx-dev-runtime', () => jest.requireActual('react/jsx-dev-runtime'), { virtual: true })

import React from 'react'
import { TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import MoneyInput from './MoneyInput'

const mounted: ReactTestRenderer[] = []

function render(props: Partial<React.ComponentProps<typeof MoneyInput>> = {}) {
  const onValueChange = jest.fn()
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(<MoneyInput value="" onValueChange={onValueChange} decimals={0} placeholder="0" {...props} />)
  })
  mounted.push(renderer)
  return { input: renderer.root.findAllByType(TextInput)[0], onValueChange }
}

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
})

/** Étude prix décimaux, phase 5 : champ de prix. À 0 décimale il se comporte exactement comme l'ancien champ d'entiers ;
 *  avec des décimales il accepte la virgule ou le point. */
describe('MoneyInput (mobile)', () => {
  it('0 décimale : clavier d’entiers, et ne garde que les chiffres comme avant', () => {
    const { input, onValueChange } = render({ decimals: 0 })

    expect(input.props.keyboardType).toBe('number-pad')
    act(() => input.props.onChangeText('12000'))
    expect(onValueChange).toHaveBeenLastCalledWith('12000')
  })

  it('0 décimale : un collage formaté « 1.000.000 » garde toute sa valeur', () => {
    const { input, onValueChange } = render({ decimals: 0 })

    act(() => input.props.onChangeText('1.000.000'))
    expect(onValueChange).toHaveBeenLastCalledWith('1000000')
  })

  it('avec décimales : clavier décimal, virgule ou point, partie décimale tronquée', () => {
    const { input, onValueChange } = render({ decimals: 2 })

    expect(input.props.keyboardType).toBe('decimal-pad')
    act(() => input.props.onChangeText('12,5'))
    expect(onValueChange).toHaveBeenLastCalledWith('12.5')
    act(() => input.props.onChangeText('12.345'))
    expect(onValueChange).toHaveBeenLastCalledWith('12.34')
  })

  it('reste un champ contrôlé et transmet placeholder et style', () => {
    const { input } = render({ value: '333.33', decimals: 2, placeholder: 'Prix', className: 'amount h-[54px]' })

    expect(input.props.value).toBe('333.33')
    expect(input.props.placeholder).toBe('Prix')
    expect(input.props.className).toBe('amount h-[54px]')
  })
})
